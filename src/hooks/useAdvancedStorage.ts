/**
 * 高级存储Hook - 智能选择存储方案
 * 优先使用IndexedDB，降级到localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import { ChatSession } from '@/types/chat';
import { storageManager, isIndexedDBAvailable, type CompressedSession } from '@/lib/storage';

interface StorageState {
  sessions: ChatSession[];
  isLoading: boolean;
  error: string | null;
  storageType: 'indexeddb' | 'localstorage' | 'none';
  stats?: {
    totalSessions: number;
    totalMessages: number;
    estimatedSize: number;
  };
}

interface StorageActions {
  saveSession: (session: ChatSession) => Promise<void>;
  loadSession: (sessionId: string) => Promise<ChatSession | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  getStorageStats: () => Promise<void>;
  migrateData: () => Promise<void>;
}

export function useAdvancedStorage(): StorageState & StorageActions {
  const [state, setState] = useState<StorageState>({
    sessions: [],
    isLoading: false,
    error: null,
    storageType: 'none'
  });

  // 初始化存储系统
  const initializeStorage = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (isIndexedDBAvailable()) {
        await storageManager.initialize();
        
        // 检查是否需要从localStorage迁移数据
        const localStorageData = typeof window !== 'undefined' 
          ? localStorage.getItem('chatvortex-sessions') 
          : null;
        
        if (localStorageData) {
          console.log('🔄 检测到localStorage数据，开始自动迁移...');
          await storageManager.migrateFromLocalStorage();
          
          // 迁移完成后清除localStorage数据（可选）
          if (typeof window !== 'undefined') {
            localStorage.removeItem('chatvortex-sessions');
            console.log('✅ localStorage数据已清除，迁移完成');
          }
        }

        setState(prev => ({ ...prev, storageType: 'indexeddb' }));
        await loadSessionsFromIndexedDB();
        
      } else {
        console.warn('⚠️ IndexedDB不可用，降级到localStorage');
        setState(prev => ({ ...prev, storageType: 'localstorage' }));
        loadSessionsFromLocalStorage();
      }

    } catch (error) {
      console.error('❌ 存储初始化失败:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '存储初始化失败',
        storageType: 'localstorage'
      }));
      
      // 降级到localStorage
      loadSessionsFromLocalStorage();
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // 从IndexedDB加载会话列表
  const loadSessionsFromIndexedDB = async () => {
    try {
      const compressedSessions = await storageManager.getAllSessions();
      
      // 转换为ChatSession格式，使用压缩数据的统计信息
      const sessions: ChatSession[] = await Promise.all(compressedSessions.map(async cs => {
        console.log(`📊 会话 ${cs.title}: messageCount=${cs.messageCount}, preview="${cs.preview}"`);
        
        // 如果缺少messageCount或preview，需要修复数据
        let messageCount = cs.messageCount;
        let lastMessagePreview = cs.preview;
        
        if (typeof messageCount !== 'number' || !lastMessagePreview) {
          console.log(`🔧 修复会话数据: ${cs.title}`);
          try {
            // 加载完整会话数据来计算正确的统计信息
            const fullSession = await storageManager.getSessionWithMessages(cs.id);
            if (fullSession) {
              messageCount = fullSession.messages.length;
              lastMessagePreview = fullSession.messages[fullSession.messages.length - 1]?.content?.slice(0, 100) || '';
              
              // 更新数据库中的记录
              await storageManager.saveSession(fullSession);
              console.log(`✅ 已修复会话 ${cs.title}: ${messageCount}条消息`);
            }
          } catch (error) {
            console.error(`❌ 修复会话数据失败: ${cs.title}`, error);
            messageCount = 0;
            lastMessagePreview = '';
          }
        }
        
        return {
          id: cs.id,
          title: cs.title,
          createdAt: new Date(cs.createdAt),
          updatedAt: new Date(cs.updatedAt),
          layoutMode: cs.layoutMode as any,
          config: cs.config,
          messages: [], // 实际消息按需加载
          // 添加元数据用于预览显示
          messageCount: messageCount || 0,
          lastMessagePreview: lastMessagePreview || ''
        };
      }));

      setState(prev => ({ ...prev, sessions }));
      console.log(`📖 从IndexedDB加载${sessions.length}个会话`);

    } catch (error) {
      console.error('❌ 从IndexedDB加载会话失败:', error);
      throw error;
    }
  };

  // 从localStorage加载会话（兼容模式）
  const loadSessionsFromLocalStorage = () => {
    if (typeof window === 'undefined') return;

    try {
      const savedSessions = localStorage.getItem('chatvortex-sessions');
      if (savedSessions) {
        const sessions: ChatSession[] = JSON.parse(savedSessions).map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        }));

        setState(prev => ({ ...prev, sessions }));
        console.log(`📖 从localStorage加载${sessions.length}个会话`);
      }
    } catch (error) {
      console.error('❌ 从localStorage加载会话失败:', error);
    }
  };

  // 保存会话
  const saveSession = useCallback(async (session: ChatSession) => {
    if (state.storageType === 'indexeddb') {
      try {
        await storageManager.saveSession(session);
        
        // 更新本地状态
        setState(prev => ({
          ...prev,
          sessions: prev.sessions.some(s => s.id === session.id)
            ? prev.sessions.map(s => s.id === session.id ? session : s)
            : [session, ...prev.sessions]
        }));

      } catch (error) {
        console.error('❌ IndexedDB保存失败，降级到localStorage:', error);
        saveToLocalStorage([session, ...state.sessions.filter(s => s.id !== session.id)]);
      }
    } else {
      const updatedSessions = state.sessions.some(s => s.id === session.id)
        ? state.sessions.map(s => s.id === session.id ? session : s)
        : [session, ...state.sessions];
      
      saveToLocalStorage(updatedSessions);
      setState(prev => ({ ...prev, sessions: updatedSessions }));
    }
  }, [state.storageType, state.sessions]);

  // 加载完整会话（包含消息）
  const loadSession = useCallback(async (sessionId: string): Promise<ChatSession | null> => {
    if (state.storageType === 'indexeddb') {
      try {
        return await storageManager.getSessionWithMessages(sessionId);
      } catch (error) {
        console.error('❌ 从IndexedDB加载会话失败:', error);
        // 降级到内存中的数据
        return state.sessions.find(s => s.id === sessionId) || null;
      }
    } else {
      return state.sessions.find(s => s.id === sessionId) || null;
    }
  }, [state.storageType, state.sessions]);

  // 删除会话
  const deleteSession = useCallback(async (sessionId: string) => {
    if (state.storageType === 'indexeddb') {
      try {
        await storageManager.deleteSession(sessionId);
      } catch (error) {
        console.error('❌ IndexedDB删除失败:', error);
      }
    }

    const updatedSessions = state.sessions.filter(s => s.id !== sessionId);
    
    if (state.storageType === 'localstorage') {
      saveToLocalStorage(updatedSessions);
    }
    
    setState(prev => ({ ...prev, sessions: updatedSessions }));
  }, [state.storageType, state.sessions]);

  // 刷新会话列表
  const refreshSessions = useCallback(async () => {
    if (state.storageType === 'indexeddb') {
      await loadSessionsFromIndexedDB();
    } else {
      loadSessionsFromLocalStorage();
    }
  }, [state.storageType]);

  // 获取存储统计
  const getStorageStats = useCallback(async () => {
    if (state.storageType === 'indexeddb') {
      try {
        const stats = await storageManager.getStorageStats();
        setState(prev => ({ 
          ...prev, 
          stats: {
            totalSessions: stats.totalSessions,
            totalMessages: stats.totalMessages,
            estimatedSize: stats.estimatedSize
          }
        }));
      } catch (error) {
        console.error('❌ 获取存储统计失败:', error);
      }
    }
  }, [state.storageType]);

  // 手动数据迁移
  const migrateData = useCallback(async () => {
    if (state.storageType === 'indexeddb') {
      try {
        await storageManager.migrateFromLocalStorage();
        await refreshSessions();
        console.log('✅ 数据迁移完成');
      } catch (error) {
        console.error('❌ 数据迁移失败:', error);
        throw error;
      }
    }
  }, [state.storageType, refreshSessions]);

  // 保存到localStorage的辅助函数
  const saveToLocalStorage = (sessions: ChatSession[]) => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('chatvortex-sessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('❌ localStorage保存失败:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'localStorage存储空间不足，请清理浏览器数据' 
      }));
    }
  };

  // 初始化
  useEffect(() => {
    initializeStorage();
  }, [initializeStorage]);

  // 定期获取统计信息
  useEffect(() => {
    if (state.storageType === 'indexeddb') {
      getStorageStats();
      
      const interval = setInterval(getStorageStats, 30000); // 每30秒更新一次
      return () => clearInterval(interval);
    }
  }, [state.storageType, getStorageStats]);

  return {
    ...state,
    saveSession,
    loadSession,
    deleteSession,
    refreshSessions,
    getStorageStats,
    migrateData
  };
}

export default useAdvancedStorage;