export interface Message {
    id: string
    content: string
    role: 'user' | 'assistant'
    timestamp: Date
    isTyping?: boolean
    isStreaming?: boolean // 是否正在流式输出
}

export interface SessionConfig {
    model: string
    temperature: number
    maxTokens: number
    contextLimit: number // 上下文token限制，默认10000
    systemPrompt?: string // 角色设定/系统提示
}

// 快捷键配置接口
export interface KeyboardShortcut {
    id: string
    name: string
    description: string
    keys: string // 快捷键组合，如 "Ctrl+H"、"Cmd+Shift+H" 等
    action: 'openHistory' | 'newChat' | 'openSettings' | 'focusInput' | 'closeModal' | 'selectPrevSession' | 'selectNextSession' | 'deleteCurrentSession'
    enabled: boolean
}

// 快捷键配置
export interface ShortcutsConfig {
    shortcuts: KeyboardShortcut[]
    enabled: boolean // 全局启用/禁用快捷键
}

export interface ChatSession {
    id: string
    title: string
    messages: Message[]
    createdAt: Date
    updatedAt: Date
    layoutMode?: 'floating-cards' | 'split-screen' | 'timeline' | 'immersive'
    config?: SessionConfig // 每个会话可以有独立的配置
    // 用于预览显示的元数据（仅在会话列表中使用）
    messageCount?: number
    lastMessagePreview?: string
}

