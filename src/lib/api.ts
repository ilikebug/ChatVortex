// API配置和服务
import type { ShortcutsConfig, KeyboardShortcut } from '@/types/chat'

export interface APIConfig {
    apiKey: string
    baseUrl: string
    model: string
    temperature?: number
    maxTokens?: number
    shortcuts?: ShortcutsConfig
}

export interface ChatCompletionMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface ChatCompletionRequest {
    model: string
    messages: ChatCompletionMessage[]
    temperature?: number
    max_tokens?: number
    stream?: boolean
}

export interface ChatCompletionResponse {
    id: string
    object: string
    created: number
    model: string
    choices: {
        index: number
        message: {
            role: string
            content: string
        }
        finish_reason: string
    }[]
    usage: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}

// 创建默认快捷键配置
export function getDefaultShortcutsConfig(): ShortcutsConfig {
    const isMac = typeof window !== 'undefined' && /macintosh|mac os x/i.test(navigator.userAgent);
    const modKey = isMac ? 'Cmd' : 'Ctrl';
    
    const defaultShortcuts: KeyboardShortcut[] = [
        {
            id: 'openHistory',
            name: '打开历史记录',
            description: '快速打开会话历史列表',
            keys: `${modKey}+H`,
            action: 'openHistory',
            enabled: true
        },
        {
            id: 'newChat',
            name: '新建对话',
            description: '创建新的对话会话',
            keys: `${modKey}+N`,
            action: 'newChat',
            enabled: true
        },
        {
            id: 'openSettings',
            name: '打开设置',
            description: '打开应用程序设置',
            keys: `${modKey}+,`,
            action: 'openSettings',
            enabled: true
        },
        {
            id: 'focusInput',
            name: '聚焦输入框',
            description: '快速聚焦到消息输入框',
            keys: `${modKey}+/`,
            action: 'focusInput',
            enabled: true
        },
        {
            id: 'closeModal',
            name: '关闭弹窗',
            description: '关闭当前打开的弹窗',
            keys: 'Escape',
            action: 'closeModal',
            enabled: true
        },
        {
            id: 'selectPrevSession',
            name: '选择上一个会话',
            description: '在历史列表中选择上一个会话',
            keys: 'ArrowUp',
            action: 'selectPrevSession',
            enabled: true
        },
        {
            id: 'selectNextSession',
            name: '选择下一个会话',
            description: '在历史列表中选择下一个会话',
            keys: 'ArrowDown',
            action: 'selectNextSession',
            enabled: true
        },
        {
            id: 'deleteCurrentSession',
            name: '删除当前会话',
            description: '删除当前选中的会话（需要确认）',
            keys: `${modKey}+Backspace`,
            action: 'deleteCurrentSession',
            enabled: true
        }
    ];

    return {
        shortcuts: defaultShortcuts,
        enabled: true
    };
}

// 默认配置 - 优先从环境变量读取，否则需要用户在设置中配置
const DEFAULT_CONFIG: APIConfig = {
    apiKey: process.env.NEXT_PUBLIC_DEFAULT_API_KEY || '', // 优先从环境变量读取
    baseUrl: process.env.NEXT_PUBLIC_DEFAULT_BASE_URL || 'https://api.gpt.ge/v1',
    model: process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 2000,
    shortcuts: getDefaultShortcutsConfig()
}

export class ChatAPI {
    private config: APIConfig

    constructor(config: Partial<APIConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config }
    }

    // 更新配置
    updateConfig(newConfig: Partial<APIConfig>) {
        this.config = { ...this.config, ...newConfig }
    }

    // 发送聊天请求
    async sendMessage(messages: ChatCompletionMessage[]): Promise<string> {
        if (!this.config.apiKey) {
            throw new Error('API Key未配置，请在设置中添加您的API Key')
        }

        const requestBody = {
            model: this.config.model,
            messages,
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens
        };

        try {
            // 创建30秒超时控制器
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => {
                timeoutController.abort();
            }, 30000); // 30秒超时

            // 使用本地API代理，避免CORS问题
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify(requestBody),
                signal: timeoutController.signal
            })

            // 清除超时定时器
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error('❌ API响应错误:', errorData);
                throw new Error(
                    errorData.error?.message ||
                    `API请求失败: ${response.status} ${response.statusText}`
                )
            }

            const data: ChatCompletionResponse = await response.json()

            if (!data.choices || data.choices.length === 0) {
                throw new Error('API返回数据格式错误')
            }

            return data.choices[0].message.content
        } catch (error) {
            console.error('❌ API请求错误:', error)

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error('请求超时（30秒），请稍后重试或检查网络连接')
                }
                throw error
            }

            throw new Error('网络请求失败，请检查网络连接')
        }
    }

    // 流式聊天（如果API支持）
    async sendMessageStream(
        messages: ChatCompletionMessage[],
        onChunk: (chunk: string) => void
    ): Promise<void> {
        if (!this.config.apiKey) {
            throw new Error('API Key未配置')
        }

        try {
            // 创建30秒超时控制器
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => {
                timeoutController.abort();
            }, 30000);

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages,
                    temperature: this.config.temperature,
                    max_tokens: this.config.maxTokens,
                    stream: true
                } as ChatCompletionRequest),
                signal: timeoutController.signal
            })

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(
                    errorData.error?.message ||
                    `API请求失败: ${response.status} ${response.statusText}`
                )
            }

            const reader = response.body?.getReader()
            if (!reader) {
                throw new Error('无法读取响应流')
            }

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        const data = trimmedLine.slice(6).trim();
                        if (data === '[DONE]') {
                            return;
                        }

                        if (data) {
                            try {
                                const parsed = JSON.parse(data)
                                const content = parsed.choices?.[0]?.delta?.content
                                if (content) {
                                    onChunk(content)
                                }
                            } catch (e) {
                                // 忽略解析错误，继续处理下一块
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ 流式请求错误:', error)
            
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('流式请求超时（30秒），请稍后重试')
            }
            
            throw error
        }
    }

    // 验证API配置
    async validateConfig(): Promise<boolean> {
        try {
            await this.sendMessage([
                { role: 'user', content: 'Hello' }
            ])
            return true
        } catch (error) {
            console.error('API配置验证失败:', error)
            return false
        }
    }

}

// 模型接口定义
export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ModelsResponse {
  data: ModelInfo[];
}

// 模型列表缓存
let modelsCache: { data: ModelInfo[], timestamp: number, cacheKey: string } | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时缓存
const CACHE_STORAGE_KEY = 'chatvortex-models-cache';

// 从localStorage加载缓存
function loadModelsCache(): typeof modelsCache {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(CACHE_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // 验证缓存结构
      if (parsed.data && parsed.timestamp && parsed.cacheKey) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('加载模型缓存失败:', error);
  }
  return null;
}

// 保存缓存到localStorage
function saveModelsCache(cache: typeof modelsCache) {
  if (typeof window === 'undefined' || !cache) return;
  
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('保存模型缓存失败:', error);
  }
}

// 获取可用模型列表
export async function fetchAvailableModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
  if (!apiKey) {
    throw new Error('API Key 未配置');
  }

  // 生成缓存键
  const cacheKey = `${apiKey.slice(-10)}_${baseUrl}`;
  const now = Date.now();
  
  // 检查内存缓存
  if (!modelsCache) {
    modelsCache = loadModelsCache();
  }
  
  // 验证缓存是否有效
  if (modelsCache && 
      modelsCache.cacheKey === cacheKey && 
      (now - modelsCache.timestamp) < CACHE_DURATION) {
    console.log('🚀 使用模型列表缓存，剩余时间:', Math.round((CACHE_DURATION - (now - modelsCache.timestamp)) / (1000 * 60 * 60)), '小时');
    return modelsCache.data;
  }

  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`获取模型列表失败: ${response.status} ${response.statusText}`);
    }

    const data: ModelsResponse = await response.json();
    
    // 过滤出聊天模型（排除embedding、tts等）
    const filteredModels = data.data.filter(model => {
      const id = model.id.toLowerCase();
      return (
        (id.includes('gpt') || id.includes('claude') || id.includes('o1') || id.includes('o3') || id.includes('o4') || id.includes('chatgpt')) &&
        !id.includes('embedding') &&
        !id.includes('tts') &&
        !id.includes('dall-e') &&
        !id.includes('whisper') &&
        !id.includes('vision') && 
        !id.includes('image')
      );
    });

    // 去重处理 - 以ID为准，优先选择官方提供商
    const uniqueModels = filteredModels.reduce((acc: ModelInfo[], current) => {
      const existing = acc.find(model => model.id === current.id);
      if (!existing) {
        acc.push(current);
      } else {
        // 如果已存在，根据提供商优先级选择更好的
        const getProviderPriority = (ownedBy: string) => {
          if (ownedBy === 'openai') return 1;
          if (ownedBy === 'anthropic') return 2;
          if (ownedBy === 'google gemini') return 3;
          if (ownedBy === 'deepseek') return 4;
          if (ownedBy === 'aws') return 5;
          if (ownedBy === 'vertexai') return 6;
          return 10; // 其他提供商
        };
        
        const currentPriority = getProviderPriority(current.owned_by);
        const existingPriority = getProviderPriority(existing.owned_by);
        
        if (currentPriority < existingPriority) {
          // 用更高优先级的替换
          const index = acc.indexOf(existing);
          acc[index] = current;
        }
      }
      return acc;
    }, []);

    // 按模型系列排序
    const chatModels = uniqueModels.sort((a, b) => {
      const getModelPriority = (id: string) => {
        if (id.includes('gpt-5')) return 1;
        if (id.includes('gpt-4')) return 2;
        if (id.includes('o1') || id.includes('o3') || id.includes('o4')) return 3;
        if (id.includes('claude')) return 4;
        if (id.includes('gpt-3.5')) return 5;
        return 6;
      };
      
      const priorityA = getModelPriority(a.id);
      const priorityB = getModelPriority(b.id);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      return a.id.localeCompare(b.id);
    });

    // 更新缓存
    modelsCache = {
      data: chatModels,
      timestamp: now,
      cacheKey
    };

    // 保存到localStorage
    saveModelsCache(modelsCache);
    
    console.log('✅ 获取模型列表成功，已缓存24小时，共', chatModels.length, '个模型');
    return chatModels;

  } catch (error) {
    console.error('❌ 获取模型列表错误:', error);
    throw error;
  }
}

// 清除模型缓存
export function clearModelsCache(): void {
  modelsCache = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_STORAGE_KEY);
      console.log('✅ 模型缓存已清除');
    } catch (error) {
      console.warn('清除模型缓存失败:', error);
    }
  }
}

// 检查缓存状态
export function getModelsCacheInfo(): { 
  isCached: boolean; 
  cacheAge?: number; 
  remainingHours?: number; 
  totalModels?: number;
} {
  if (!modelsCache) {
    modelsCache = loadModelsCache();
  }
  
  if (!modelsCache) {
    return { isCached: false };
  }
  
  const now = Date.now();
  const cacheAge = now - modelsCache.timestamp;
  const remainingTime = CACHE_DURATION - cacheAge;
  
  return {
    isCached: true,
    cacheAge: Math.round(cacheAge / (1000 * 60 * 60)),
    remainingHours: Math.max(0, Math.round(remainingTime / (1000 * 60 * 60))),
    totalModels: modelsCache.data.length
  };
}

// 导出默认实例
export const chatAPI = new ChatAPI()

// Token估算函数（简单估算，1个token约等于4个字符）
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

// 上下文管理：根据token限制裁剪消息历史
export function trimMessagesForContext(
    messages: any[], 
    maxTokens: number = 10000, 
    systemPrompt?: string
): ChatCompletionMessage[] {
    const apiMessages: ChatCompletionMessage[] = []
    
    // 如果有系统提示，先添加
    if (systemPrompt) {
        apiMessages.push({
            role: 'system',
            content: systemPrompt
        })
    }
    
    // 从最新消息开始计算token
    let totalTokens = systemPrompt ? estimateTokens(systemPrompt) : 0
    const reversedMessages = [...messages].reverse()
    
    for (const msg of reversedMessages) {
        const messageTokens = estimateTokens(msg.content)
        
        // 如果加上这条消息会超过限制，就停止添加
        if (totalTokens + messageTokens > maxTokens * 0.8) { // 留20%空间给响应
            break
        }
        
        apiMessages.unshift({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        })
        
        totalTokens += messageTokens
    }
    
    return apiMessages
}

// 工具函数：将聊天消息转换为API格式（已废弃，使用上面的trimMessagesForContext）
export function convertMessagesToAPI(messages: any[]): ChatCompletionMessage[] {
    return messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
    }))
}

// 使用会话配置发送消息
export async function sendMessageWithSessionConfig(
    messages: any[],
    sessionConfig: {
        model: string
        temperature: number
        maxTokens: number
        contextLimit: number
        systemPrompt?: string
    },
    apiKey: string,
    baseUrl: string,
    onChunk?: (chunk: string) => void
): Promise<string> {
    if (!apiKey) {
        throw new Error('API Key未配置，请在设置中添加您的API Key')
    }

    // 使用上下文管理裁剪消息
    const trimmedMessages = trimMessagesForContext(
        messages, 
        sessionConfig.contextLimit, 
        sessionConfig.systemPrompt
    )

    const requestBody = {
        model: sessionConfig.model,
        messages: trimmedMessages,
        temperature: sessionConfig.temperature,
        max_tokens: sessionConfig.maxTokens,
        stream: !!onChunk
    };

    try {
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
            timeoutController.abort();
        }, 30000);

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: timeoutController.signal
        })

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(
                errorData.error?.message ||
                `API请求失败: ${response.status} ${response.statusText}`
            )
        }

        if (onChunk) {
            // 流式处理
            const reader = response.body?.getReader()
            if (!reader) {
                throw new Error('无法读取响应流')
            }

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break;

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        const data = trimmedLine.slice(6).trim();
                        if (data === '[DONE]') return '';

                        if (data) {
                            try {
                                const parsed = JSON.parse(data)
                                const content = parsed.choices?.[0]?.delta?.content
                                if (content) {
                                    onChunk(content)
                                }
                            } catch (e) {
                                // 忽略解析错误
                            }
                        }
                    }
                }
            }
            return ''
        } else {
            // 非流式处理
            const data: ChatCompletionResponse = await response.json()
            if (!data.choices || data.choices.length === 0) {
                throw new Error('API返回数据格式错误')
            }
            return data.choices[0].message.content
        }
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('请求超时，请稍后重试')
        }
        throw error
    }
}
