/**
 * 高级存储管理器 - 使用IndexedDB替代localStorage限制
 * 支持无限量聊天记录存储、数据压缩、分页加载等
 */

import { ChatSession, Message } from '@/types/chat';

// 存储配置
const DB_NAME = 'ChatVortexDB';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const MESSAGES_STORE = 'messages';
const METADATA_STORE = 'metadata';

// 数据库接口
interface ChatDB extends IDBDatabase {}

// 压缩后的会话数据
interface CompressedSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  layoutMode?: string;
  config?: any;
  messageCount: number;
  lastMessageId?: string;
  preview?: string; // 最后一条消息的预览
}

// 存储管理器类
class StorageManager {
  private db: ChatDB | null = null;
  private isInitialized = false;

  // 初始化数据库
  async initialize(): Promise<void> {
    if (this.isInitialized && this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ 无法打开IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result as ChatDB;
        this.isInitialized = true;
        console.log('✅ IndexedDB初始化成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result as ChatDB;

        // 创建会话存储
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          const sessionStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
          sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 创建消息存储
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          const messageStore = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
          messageStore.createIndex('sessionId', 'sessionId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
          messageStore.createIndex('sessionTimestamp', ['sessionId', 'timestamp'], { unique: false });
        }

        // 创建元数据存储
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
        }

        console.log('📁 IndexedDB数据库结构创建完成');
      };
    });
  }

  // 确保数据库已初始化
  private async ensureDB(): Promise<ChatDB> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }
    if (!this.db) throw new Error('数据库初始化失败');
    return this.db;
  }

  // 保存会话（分离存储会话元数据和消息）
  async saveSession(session: ChatSession): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([SESSIONS_STORE, MESSAGES_STORE], 'readwrite');

    try {
      // 分离会话元数据和消息
      const { messages, ...sessionMetadata } = session;
      
      const compressedSession: CompressedSession = {
        ...sessionMetadata,
        messageCount: messages.length,
        lastMessageId: messages[messages.length - 1]?.id,
        preview: messages[messages.length - 1]?.content?.slice(0, 100)
      };

      // 保存会话元数据
      const sessionStore = transaction.objectStore(SESSIONS_STORE);
      await this.promisifyRequest(sessionStore.put(compressedSession));

      // 保存消息（每条消息添加sessionId）
      const messageStore = transaction.objectStore(MESSAGES_STORE);
      for (const message of messages) {
        const messageWithSession = { ...message, sessionId: session.id };
        await this.promisifyRequest(messageStore.put(messageWithSession));
      }

      await this.promisifyRequest(transaction);
      console.log(`💾 保存会话成功: ${session.title} (${messages.length}条消息)`);

    } catch (error) {
      console.error('❌ 保存会话失败:', error);
      throw error;
    }
  }

  // 获取所有会话元数据（用于历史列表显示）
  async getAllSessions(): Promise<CompressedSession[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction([SESSIONS_STORE], 'readonly');
    const store = transaction.objectStore(SESSIONS_STORE);
    const index = store.index('updatedAt');

    const request = index.getAll();
    const sessions = await this.promisifyRequest(request);

    // 按更新时间倒序排列
    return (sessions as CompressedSession[]).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  // 获取完整会话（包含所有消息）
  async getSessionWithMessages(sessionId: string): Promise<ChatSession | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction([SESSIONS_STORE, MESSAGES_STORE], 'readonly');

    try {
      // 获取会话元数据
      const sessionStore = transaction.objectStore(SESSIONS_STORE);
      const sessionRequest = sessionStore.get(sessionId);
      const sessionData = await this.promisifyRequest(sessionRequest) as CompressedSession;

      if (!sessionData) return null;

      // 获取会话的所有消息
      const messageStore = transaction.objectStore(MESSAGES_STORE);
      const messageIndex = messageStore.index('sessionTimestamp');
      const range = IDBKeyRange.bound([sessionId, new Date(0)], [sessionId, new Date()]);
      const messagesRequest = messageIndex.getAll(range);
      const messages = await this.promisifyRequest(messagesRequest) as (Message & { sessionId: string })[];

      // 重组完整会话数据
      const fullSession: ChatSession = {
        id: sessionData.id,
        title: sessionData.title,
        createdAt: new Date(sessionData.createdAt),
        updatedAt: new Date(sessionData.updatedAt),
        layoutMode: sessionData.layoutMode as any,
        config: sessionData.config,
        messages: messages.map(({ sessionId, ...msg }) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      };

      console.log(`📖 加载会话: ${fullSession.title} (${fullSession.messages.length}条消息)`);
      return fullSession;

    } catch (error) {
      console.error('❌ 获取会话失败:', error);
      return null;
    }
  }

  // 分页获取会话消息（用于大量消息的分页加载）
  async getSessionMessages(
    sessionId: string, 
    limit: number = 50, 
    before?: Date
  ): Promise<Message[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction([MESSAGES_STORE], 'readonly');
    const messageStore = transaction.objectStore(MESSAGES_STORE);
    const index = messageStore.index('sessionTimestamp');

    const upperBound = before || new Date();
    const range = IDBKeyRange.bound([sessionId, new Date(0)], [sessionId, upperBound]);
    
    const request = index.getAll(range, limit);
    const messages = await this.promisifyRequest(request) as (Message & { sessionId: string })[];

    return messages
      .map(({ sessionId, ...msg }) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) // 最新的在前
      .slice(0, limit);
  }

  // 删除会话
  async deleteSession(sessionId: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([SESSIONS_STORE, MESSAGES_STORE], 'readwrite');

    try {
      // 删除会话元数据
      const sessionStore = transaction.objectStore(SESSIONS_STORE);
      await this.promisifyRequest(sessionStore.delete(sessionId));

      // 删除会话的所有消息
      const messageStore = transaction.objectStore(MESSAGES_STORE);
      const messageIndex = messageStore.index('sessionId');
      const messagesRequest = messageIndex.getAll(sessionId);
      const messages = await this.promisifyRequest(messagesRequest);

      for (const message of messages) {
        await this.promisifyRequest(messageStore.delete(message.id));
      }

      await this.promisifyRequest(transaction);
      console.log(`🗑️ 删除会话成功: ${sessionId}`);

    } catch (error) {
      console.error('❌ 删除会话失败:', error);
      throw error;
    }
  }

  // 获取存储统计信息
  async getStorageStats(): Promise<{
    totalSessions: number;
    totalMessages: number;
    estimatedSize: number;
    oldestSession?: Date;
    newestSession?: Date;
  }> {
    const db = await this.ensureDB();
    const transaction = db.transaction([SESSIONS_STORE, MESSAGES_STORE], 'readonly');

    try {
      // 统计会话数量
      const sessionStore = transaction.objectStore(SESSIONS_STORE);
      const sessionCountRequest = sessionStore.count();
      const totalSessions = await this.promisifyRequest(sessionCountRequest);

      // 统计消息数量
      const messageStore = transaction.objectStore(MESSAGES_STORE);
      const messageCountRequest = messageStore.count();
      const totalMessages = await this.promisifyRequest(messageCountRequest);

      // 获取所有会话来计算时间范围和大小
      const sessionsRequest = sessionStore.getAll();
      const sessions = await this.promisifyRequest(sessionsRequest) as CompressedSession[];

      let oldestSession: Date | undefined;
      let newestSession: Date | undefined;

      if (sessions.length > 0) {
        const dates = sessions.map(s => new Date(s.createdAt));
        oldestSession = new Date(Math.min(...dates.map(d => d.getTime())));
        newestSession = new Date(Math.max(...dates.map(d => d.getTime())));
      }

      // 估算存储大小（简单估算）
      const estimatedSize = totalMessages * 500; // 假设每条消息平均500字节

      return {
        totalSessions,
        totalMessages,
        estimatedSize,
        oldestSession,
        newestSession
      };

    } catch (error) {
      console.error('❌ 获取存储统计失败:', error);
      return {
        totalSessions: 0,
        totalMessages: 0,
        estimatedSize: 0
      };
    }
  }

  // 数据迁移：从localStorage迁移到IndexedDB
  async migrateFromLocalStorage(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const localStorageData = localStorage.getItem('chatvortex-sessions');
      if (!localStorageData) return;

      const sessions: ChatSession[] = JSON.parse(localStorageData);
      console.log(`🔄 开始迁移${sessions.length}个会话从localStorage到IndexedDB`);

      for (const session of sessions) {
        // 确保日期对象正确
        const migratedSession: ChatSession = {
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          messages: session.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        };

        await this.saveSession(migratedSession);
      }

      // 迁移完成后可以选择清除localStorage数据
      console.log('✅ 数据迁移完成');
      
    } catch (error) {
      console.error('❌ 数据迁移失败:', error);
    }
  }

  // 工具方法：Promise化IDB请求
  private promisifyRequest<T>(request: IDBRequest<T> | IDBTransaction): Promise<T> {
    return new Promise((resolve, reject) => {
      if ('result' in request) {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } else {
        request.oncomplete = () => resolve(undefined as T);
        request.onerror = () => reject(request.error);
      }
    });
  }
}

// 导出单例实例
export const storageManager = new StorageManager();

// 兼容性检查
export function isIndexedDBAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return 'indexedDB' in window && indexedDB !== null;
}

// 导出类型
export type { CompressedSession };