"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChatInput, type ChatInputRef } from "@/components/ChatInput";
import { MessageRenderer } from "@/components/MessageRenderer";
import { TypewriterEffect } from "@/components/TypewriterEffect";
import { SettingsModal } from "@/components/SettingsModal";
import { HistoryModal } from "@/components/HistoryModal";
import { SessionConfigModal } from "@/components/SessionConfigModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ImageGenerator } from "@/components/ImageGenerator";
import { ImageGallery } from "@/components/ImageGallery";
import { Message, ChatSession, SessionConfig } from "@/types/chat";
import { ImageResult } from "@/types/image";
import {
  generateId,
  getLocalStorageUsage,
  formatBytes,
  cleanupLargeLocalStorageItems,
} from "@/lib/utils";
import { useAdvancedStorage } from "@/hooks/useAdvancedStorage";
import {
  chatAPI,
  convertMessagesToAPI,
  APIConfig,
  sendMessageWithSessionConfig,
  getDefaultShortcutsConfig,
} from "@/lib/api";
import {
  useKeyboardShortcuts,
  type ShortcutActions,
} from "@/hooks/useKeyboardShortcuts";

type LayoutMode = "floating-cards" | "split-screen" | "timeline" | "immersive";

export default function ChatPage() {
  // 使用新的高级存储系统
  const storage = useAdvancedStorage();

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSessionConfig, setShowSessionConfig] = useState(false);
  const [showImageGenerator, setShowImageGenerator] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("immersive");
  const [isMounted, setIsMounted] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState<APIConfig>({
    apiKey: process.env.NEXT_PUBLIC_DEFAULT_API_KEY || "",
    baseUrl: "https://api.gpt.ge/v1",
    model: "gpt-3.5-turbo",
    temperature: 0.7,
    maxTokens: 2000,
    shortcuts: getDefaultShortcutsConfig(),
  });

  // 从存储系统获取会话数据
  const sessions = storage.sessions;

  // 消息分页状态
  const [visibleMessageCount, setVisibleMessageCount] = useState(10); // 初始只显示10条消息
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isNewSessionLoad, setIsNewSessionLoad] = useState(true); // 标记是否为新会话加载
  const [isInputCollapsed, setIsInputCollapsed] = useState(true); // ChatInput折叠状态 - 默认折叠

  // 消息容器引用
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const splitScreenAIRef = useRef<HTMLDivElement>(null);
  const immersiveRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);

  // 滚动到最新消息
  const scrollToLatestMessage = useCallback((layoutMode?: string) => {
    // 延迟执行，确保DOM已更新，并且尝试多次以确保成功
    const attemptScroll = (attempts = 0) => {
      if (attempts > 3) return; // 最多尝试3次

      setTimeout(
        () => {
          const sessionLayoutMode = layoutMode || "timeline";
          let container: HTMLElement | null = null;

          if (sessionLayoutMode === "split-screen") {
            container = splitScreenAIRef.current;
          } else if (sessionLayoutMode === "immersive") {
            container = immersiveRef.current;
          } else {
            container = messagesContainerRef.current;
          }

          if (container && container.scrollHeight > 0) {
            console.log(
              `滚动到最新消息，容器高度: ${container.scrollHeight}, 尝试次数: ${attempts}`
            );
            container.scrollTo({
              top: container.scrollHeight,
              behavior: attempts === 0 ? "auto" : "smooth", // 第一次立即滚动
            });
          } else {
            console.log(
              `容器未准备好，尝试次数: ${attempts}, 容器存在: ${!!container}, 高度: ${container?.scrollHeight}`
            );
            // 如果容器还没准备好，再次尝试
            attemptScroll(attempts + 1);
          }
        },
        attempts === 0 ? 50 : 200
      ); // 第一次快速，后续较慢
    };

    attemptScroll();
  }, []);

  // 获取要显示的消息（从最新消息开始）
  const getVisibleMessages = useCallback(
    (messages: Message[]) => {
      if (messages.length <= visibleMessageCount) {
        console.log(`显示全部 ${messages.length} 条消息`);
        return messages;
      }
      // 从最后开始取指定数量的消息
      const visibleMessages = messages.slice(-visibleMessageCount);
      console.log(
        `显示最新 ${visibleMessages.length} 条消息，总共 ${messages.length} 条`
      );
      return visibleMessages;
    },
    [visibleMessageCount]
  );

  // 加载更多消息
  const loadMoreMessages = useCallback(() => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);
    // 模拟加载延迟，然后增加可见消息数量
    setTimeout(() => {
      setVisibleMessageCount((prev) => {
        // 使用当前会话状态而不是从数组查找
        const messageCount = currentSession?.messages.length || 0;
        return Math.min(prev + 10, messageCount);
      });
      setIsLoadingMore(false);
      setIsNewSessionLoad(false); // 加载更多时不再是新会话加载
    }, 300);
  }, [isLoadingMore, currentSession]);

  // 重置消息显示数量（当切换会话时）
  const resetVisibleMessages = useCallback(() => {
    setVisibleMessageCount(10);
    setIsNewSessionLoad(true); // 标记为新会话加载
  }, []);

  // 处理滚动事件，当滚动到顶部时加载更多消息
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      const { scrollTop } = container;

      // 当滚动到顶部附近（50px）时，加载更多消息
      if (scrollTop <= 50 && !isLoadingMore) {
        if (
          currentSession &&
          visibleMessageCount < currentSession.messages.length
        ) {
          loadMoreMessages();
        }
      }
    },
    [isLoadingMore, currentSession, visibleMessageCount, loadMoreMessages]
  );

  // 从localStorage加载配置
  useEffect(() => {
    const savedConfig = localStorage.getItem("chatvortex-config");
    const savedSessions = localStorage.getItem("chatvortex-sessions");

    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        // 确保快捷键配置存在，如果不存在则使用默认配置
        const mergedConfig = {
          ...config,
          shortcuts: config.shortcuts || getDefaultShortcutsConfig(),
        };
        setApiConfig(mergedConfig);
        chatAPI.updateConfig(mergedConfig);
      } catch (error) {
        console.error("加载配置失败:", error);
      }
    }

    if (savedSessions) {
      try {
        const sessions = JSON.parse(savedSessions);
        // 数据迁移已由 useAdvancedStorage 自动处理，无需手动设置
      } catch (error) {
        console.error("加载会话失败:", error);
      }
    }

    // 设置挂载状态，确保动画在客户端执行
    setIsMounted(true);
  }, [apiConfig.model, apiConfig.temperature, apiConfig.maxTokens]);

  // 保存配置和会话到localStorage
  useEffect(() => {
    // 只有在组件挂载完成后才保存，避免初始化时覆盖localStorage
    if (!isMounted) return;

    try {
      localStorage.setItem("chatvortex-config", JSON.stringify(apiConfig));
    } catch (error) {
      console.error("保存配置失败:", error);
    }
  }, [apiConfig, isMounted]);

  useEffect(() => {
    // 只有在组件挂载完成后才保存，避免初始化时覆盖localStorage
    if (!isMounted) return;

    try {
      // 检查localStorage使用情况
      const usage = getLocalStorageUsage();
      console.log(
        `📊 localStorage使用情况 (${usage.browser}): ${usage.percentage.toFixed(1)}% (${formatBytes(usage.used)}/${formatBytes(usage.available)})`
      );

      // 如果使用率超过90%，尝试清理
      if (usage.percentage > 90) {
        console.warn("⚠️ localStorage使用率过高，开始清理...");
        cleanupLargeLocalStorageItems();
      }

      const sessionsData = JSON.stringify(sessions);
      localStorage.setItem("chatvortex-sessions", sessionsData);

      // 记录会话数据大小
      const dataSize = sessionsData.length * 2; // UTF-16
      console.log(
        `💾 保存${sessions.length}个会话，数据大小: ${formatBytes(dataSize)}`
      );
    } catch (error) {
      console.error("保存会话失败:", error);

      // 如果是空间不足错误，尝试清理后重试
      if (error instanceof Error && error.name === "QuotaExceededError") {
        console.warn("🚨 localStorage空间不足，尝试清理后重试...");
        try {
          // 只保留最近的6个会话
          const recentSessions = sessions.slice(0, 6);
          localStorage.setItem(
            "chatvortex-sessions",
            JSON.stringify(recentSessions)
          );
          console.log(`✅ 已清理为最近的${recentSessions.length}个会话`);

          // 状态更新由 storage.refreshSessions() 处理
          storage.refreshSessions();

          // 如果当前会话被清理了，重置
          if (
            currentSessionId &&
            !recentSessions.some((s) => s.id === currentSessionId)
          ) {
            setCurrentSessionId(null);
          }
        } catch (retryError) {
          console.error("💥 重试保存也失败了:", retryError);
        }
      }
    }
  }, [sessions, isMounted, currentSessionId]);

  // 当前会话现在通过状态管理，不再从sessions数组中查找

  // 当会话切换时滚动到最新消息
  useEffect(() => {
    if (
      currentSessionId &&
      currentSession &&
      currentSession.messages.length > 0
    ) {
      resetVisibleMessages(); // 重置可见消息数量
      // 立即滚动到最新消息
      setTimeout(() => {
        scrollToLatestMessage(currentSession.layoutMode || "timeline");
      }, 100);
    }
  }, [
    currentSessionId,
    currentSession,
    scrollToLatestMessage,
    resetVisibleMessages,
  ]);

  // 当visibleMessageCount变化时，也尝试保持在底部（仅针对新会话）
  useEffect(() => {
    if (currentSessionId && currentSession && visibleMessageCount === 10) {
      // 这是新打开的会话，确保滚动到底部
      setTimeout(() => {
        scrollToLatestMessage(currentSession.layoutMode || "timeline");
      }, 200);
    }
  }, [
    visibleMessageCount,
    currentSessionId,
    currentSession,
    scrollToLatestMessage,
  ]);

  // 获取默认会话配置
  const getDefaultSessionConfig = useCallback(
    (): SessionConfig => ({
      model: apiConfig.model,
      temperature: apiConfig.temperature || 0.7,
      maxTokens: apiConfig.maxTokens || 2000,
      contextLimit: 10000,
      systemPrompt: undefined,
    }),
    [apiConfig]
  );

  // 创建新会话
  const handleNewChat = useCallback(async () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: "新的维度",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      layoutMode: "immersive", // 新会话默认使用沉浸式布局
      config: getDefaultSessionConfig(), // 添加默认配置
    };

    try {
      await storage.saveSession(newSession);
      setCurrentSessionId(newSession.id);
      setCurrentSession(newSession);
      console.log("✅ 新会话创建成功");
    } catch (error) {
      console.error("❌ 创建新会话失败:", error);
    }
  }, [getDefaultSessionConfig, storage]);

  // 选择会话
  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      try {
        // 先设置当前会话ID
        setCurrentSessionId(sessionId);

        // 异步加载完整的会话数据（包含所有消息）
        const fullSession = await storage.loadSession(sessionId);
        if (fullSession) {
          setCurrentSession(fullSession);
          console.log(
            `📖 已加载会话: ${fullSession.title} (${fullSession.messages.length}条消息)`
          );
        } else {
          setCurrentSession(null);
          console.warn(`⚠️ 无法加载会话: ${sessionId}`);
        }
      } catch (error) {
        console.error("❌ 加载会话失败:", error);
        setCurrentSession(null);
      }
    },
    [storage]
  );

  // 删除会话
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await storage.deleteSession(sessionId);
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setCurrentSession(null);
        }
        console.log("✅ 会话删除成功");
      } catch (error) {
        console.error("❌ 删除会话失败:", error);
      }
    },
    [currentSessionId, storage]
  );

  // 重命名会话
  const handleRenameSession = useCallback(
    async (sessionId: string, newTitle: string) => {
      try {
        const session = await storage.loadSession(sessionId);
        if (session) {
          const updatedSession = {
            ...session,
            title: newTitle,
            updatedAt: new Date(),
          };
          await storage.saveSession(updatedSession);

          // 如果重命名的是当前会话，同步更新当前会话状态
          if (session.id === currentSessionId) {
            setCurrentSession(updatedSession);
          }

          console.log("✅ 会话重命名成功");
        }
      } catch (error) {
        console.error("❌ 重命名会话失败:", error);
      }
    },
    [storage, currentSessionId]
  );

  // 发送消息
  const handleSendMessage = useCallback(
    async (content: string, files?: File[], images?: any[]) => {
      let sessionId = currentSessionId;
      let workingSession: ChatSession;

      if (!sessionId) {
        const newSession: ChatSession = {
          id: generateId(),
          title: content.slice(0, 30),
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          layoutMode: "immersive", // 新会话默认使用沉浸式布局
          config: getDefaultSessionConfig(), // 添加默认配置
        };

        await storage.saveSession(newSession);
        sessionId = newSession.id;
        setCurrentSessionId(sessionId);
        setCurrentSession(newSession);
        workingSession = newSession;
      } else {
        // 加载完整会话数据（包含消息）
        const loadedSession = await storage.loadSession(sessionId);
        if (!loadedSession) {
          console.error("❌ 无法加载当前会话");
          return;
        }
        workingSession = loadedSession;
      }

      const userMessage: Message = {
        id: generateId(),
        content,
        role: "user",
        timestamp: new Date(),
        files: files && files.length > 0 ? files : undefined,
        images: images && images.length > 0 ? images : undefined,
      };

      // 更新会话并保存
      const updatedSession = {
        ...workingSession,
        messages: [...workingSession.messages, userMessage],
        title:
          workingSession.messages.length === 0
            ? content.slice(0, 30)
            : workingSession.title,
        updatedAt: new Date(),
      };

      await storage.saveSession(updatedSession);
      setCurrentSession(updatedSession); // 同步更新当前会话状态
      setIsLoading(true);

      try {
        const allMessages = [...workingSession.messages, userMessage];
        // 获取会话配置，如果没有则使用默认配置
        const sessionConfig =
          workingSession.config || getDefaultSessionConfig();
        let assistantContent = "";

        if (!apiConfig.apiKey) {
          assistantContent =
            "⚠️ 请先配置API Key\n\n请点击右上角的设置按钮，输入您的API Key后再开始对话。\n\n如果您还没有API Key，可以前往 https://api.gpt.ge 获取。";

          const assistantMessage: Message = {
            id: generateId(),
            content: assistantContent,
            role: "assistant",
            timestamp: new Date(),
            isStreaming: false,
          };

          const finalSession = {
            ...updatedSession,
            messages: [...updatedSession.messages, assistantMessage],
            updatedAt: new Date(),
          };

          await storage.saveSession(finalSession);
          setCurrentSession(finalSession); // 同步更新当前会话状态
        } else {
          // 创建空的助手消息，准备流式更新
          const assistantMessageId = generateId();
          let assistantMessage: Message = {
            id: assistantMessageId,
            content: "",
            role: "assistant",
            timestamp: new Date(),
            isStreaming: true, // 标记为流式接收中
          };

          // 先添加空消息并保存
          let streamingSession = {
            ...updatedSession,
            messages: [...updatedSession.messages, assistantMessage],
            updatedAt: new Date(),
          };

          await storage.saveSession(streamingSession);
          setCurrentSession(streamingSession); // 同步更新当前会话状态

          try {
            // 处理图片数据，转换为V-API格式
            const processedMessages = allMessages.map((msg) => {
              if (msg.role === "user" && msg.images && msg.images.length > 0) {
                // 构建多模态内容
                const content = [
                  {
                    type: "text",
                    text: msg.content || "请分析这些图片",
                  },
                  ...msg.images.map((img) => ({
                    type: "image_url",
                    image_url: {
                      url: img.url,
                      detail: "auto",
                    },
                  })),
                ];

                return {
                  role: msg.role,
                  content: content,
                };
              } else {
                return {
                  role: msg.role,
                  content: msg.content,
                };
              }
            });

            // 使用新的会话配置API
            await sendMessageWithSessionConfig(
              processedMessages,
              sessionConfig,
              apiConfig.apiKey,
              apiConfig.baseUrl,
              (chunk: string) => {
                // 实时更新消息内容
                assistantMessage = {
                  ...assistantMessage,
                  content: assistantMessage.content + chunk,
                };

                streamingSession = {
                  ...streamingSession,
                  messages: streamingSession.messages.map((msg) =>
                    msg.id === assistantMessageId ? assistantMessage : msg
                  ),
                  updatedAt: new Date(),
                };

                // 实时同步到UI状态，确保打字机效果正常显示
                setCurrentSession(streamingSession);

                // 定期保存流式更新（每50个字符保存一次，避免频繁写入）
                if (assistantMessage.content.length % 50 === 0) {
                  storage.saveSession(streamingSession);
                }
              }
            );

            // 流式接收完成，标记为非流式状态并最终保存
            assistantMessage.isStreaming = false;
            streamingSession = {
              ...streamingSession,
              messages: streamingSession.messages.map((msg) =>
                msg.id === assistantMessageId ? assistantMessage : msg
              ),
              updatedAt: new Date(),
            };

            await storage.saveSession(streamingSession);
            setCurrentSession(streamingSession); // 同步更新当前会话状态
          } catch (apiError) {
            console.error("❌ API调用失败:", apiError);

            let errorMessage = "网络连接失败";
            if (apiError instanceof Error) {
              if (apiError.message.includes("超时")) {
                errorMessage = `⏰ 请求超时\n\n服务器响应时间过长，请稍后重试。`;
              } else if (apiError.message.includes("401")) {
                errorMessage = `🔑 API Key无效\n\n请检查您的API Key是否正确。`;
              } else if (apiError.message.includes("403")) {
                errorMessage = `🚫 访问被拒绝\n\n可能是权限不足或余额不足。`;
              } else {
                errorMessage = `🔌 连接失败\n\n${apiError.message}`;
              }
            }

            // 更新为错误消息并保存
            assistantMessage = {
              ...assistantMessage,
              content: errorMessage,
              isStreaming: false,
            };

            streamingSession = {
              ...streamingSession,
              messages: streamingSession.messages.map((msg) =>
                msg.id === assistantMessageId ? assistantMessage : msg
              ),
              updatedAt: new Date(),
            };

            await storage.saveSession(streamingSession);
            setCurrentSession(streamingSession); // 同步更新当前会话状态
          }
        }
      } catch (error) {
        console.error("发送消息失败:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [currentSessionId, apiConfig, getDefaultSessionConfig, storage]
  );

  const handleSaveSettings = useCallback((newConfig: APIConfig) => {
    setApiConfig(newConfig);
    chatAPI.updateConfig(newConfig);
  }, []);

  // 更新会话配置
  const handleUpdateSessionConfig = useCallback(
    async (newConfig: SessionConfig) => {
      if (!currentSessionId) return;

      try {
        const session = await storage.loadSession(currentSessionId);
        if (session) {
          const updatedSession = {
            ...session,
            config: newConfig,
            updatedAt: new Date(),
          };
          await storage.saveSession(updatedSession);
          setCurrentSession(updatedSession); // 同步更新当前会话状态
          console.log("✅ 会话配置更新成功");
        }
      } catch (error) {
        console.error("❌ 更新会话配置失败:", error);
      }
    },
    [currentSessionId, storage]
  );

  // 重新生成AI消息
  const handleRegenerateMessage = useCallback(
    async (messageId: string) => {
      if (!currentSession) return;

      try {
        setIsLoading(true);

        // 找到要重新生成的消息在数组中的位置
        const messageIndex = currentSession.messages.findIndex(
          (msg) => msg.id === messageId
        );
        if (messageIndex === -1) return;

        // 找到该消息之前的最后一个用户消息，作为重新生成的上下文
        const previousMessages = currentSession.messages.slice(0, messageIndex);

        // 移除从该AI消息开始的所有后续消息
        const messagesBeforeRegeneration = previousMessages;

        // 更新会话，移除要重新生成的消息及其后续消息
        const updatedSession = {
          ...currentSession,
          messages: messagesBeforeRegeneration,
          updatedAt: new Date(),
        };

        await storage.saveSession(updatedSession);
        setCurrentSession(updatedSession);

        // 获取会话配置
        const sessionConfig =
          currentSession.config || getDefaultSessionConfig();

        if (!apiConfig.apiKey) {
          const errorMessage =
            "⚠️ 请先配置API Key\n\n请点击右上角的设置按钮，输入您的API Key后再开始对话。";

          const newAssistantMessage: Message = {
            id: generateId(),
            content: errorMessage,
            role: "assistant",
            timestamp: new Date(),
            isStreaming: false,
          };

          const finalSession = {
            ...updatedSession,
            messages: [...updatedSession.messages, newAssistantMessage],
            updatedAt: new Date(),
          };

          await storage.saveSession(finalSession);
          setCurrentSession(finalSession);
          return;
        }

        // 创建新的AI消息用于重新生成
        const newAssistantMessageId = generateId();
        let newAssistantMessage: Message = {
          id: newAssistantMessageId,
          content: "",
          role: "assistant",
          timestamp: new Date(),
          isStreaming: true,
        };

        // 添加新的空AI消息
        let streamingSession = {
          ...updatedSession,
          messages: [...updatedSession.messages, newAssistantMessage],
          updatedAt: new Date(),
        };

        await storage.saveSession(streamingSession);
        setCurrentSession(streamingSession);

        try {
          // 重新生成AI回复
          await sendMessageWithSessionConfig(
            messagesBeforeRegeneration,
            sessionConfig,
            apiConfig.apiKey,
            apiConfig.baseUrl,
            (chunk: string) => {
              // 实时更新消息内容
              newAssistantMessage = {
                ...newAssistantMessage,
                content: newAssistantMessage.content + chunk,
              };

              streamingSession = {
                ...streamingSession,
                messages: streamingSession.messages.map((msg) =>
                  msg.id === newAssistantMessageId ? newAssistantMessage : msg
                ),
                updatedAt: new Date(),
              };

              // 实时同步到UI状态
              setCurrentSession(streamingSession);

              // 定期保存
              if (newAssistantMessage.content.length % 50 === 0) {
                storage.saveSession(streamingSession);
              }
            }
          );

          // 标记流式接收完成
          newAssistantMessage.isStreaming = false;
          streamingSession = {
            ...streamingSession,
            messages: streamingSession.messages.map((msg) =>
              msg.id === newAssistantMessageId ? newAssistantMessage : msg
            ),
            updatedAt: new Date(),
          };

          await storage.saveSession(streamingSession);
          setCurrentSession(streamingSession);
        } catch (apiError) {
          console.error("❌ 重新生成失败:", apiError);

          let errorMessage = "重新生成失败";
          if (apiError instanceof Error) {
            if (apiError.message.includes("超时")) {
              errorMessage = `⏰ 请求超时\n\n服务器响应时间过长，请稍后重试。`;
            } else if (apiError.message.includes("401")) {
              errorMessage = `🔑 API Key无效\n\n请检查您的API Key是否正确。`;
            } else if (apiError.message.includes("403")) {
              errorMessage = `🚫 访问被拒绝\n\n可能是权限不足或余额不足。`;
            } else {
              errorMessage = `🔌 连接失败\n\n${apiError.message}`;
            }
          }

          // 更新为错误消息
          newAssistantMessage = {
            ...newAssistantMessage,
            content: errorMessage,
            isStreaming: false,
          };

          streamingSession = {
            ...streamingSession,
            messages: streamingSession.messages.map((msg) =>
              msg.id === newAssistantMessageId ? newAssistantMessage : msg
            ),
            updatedAt: new Date(),
          };

          await storage.saveSession(streamingSession);
          setCurrentSession(streamingSession);
        }
      } catch (error) {
        console.error("重新生成消息失败:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [currentSession, storage, apiConfig, getDefaultSessionConfig]
  );

  // 复制消息内容
  const handleCopyMessage = useCallback(
    async (messageId: string, content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedMessageId(messageId);
        // 2秒后清除复制状态
        setTimeout(() => setCopiedMessageId(null), 2000);
      } catch (error) {
        console.error("复制失败:", error);
        // 降级方案：创建临时文本框进行复制
        const textArea = document.createElement("textarea");
        textArea.value = content;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
          setCopiedMessageId(messageId);
          setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (fallbackError) {
          console.error("降级复制也失败:", fallbackError);
        } finally {
          document.body.removeChild(textArea);
        }
      }
    },
    []
  );

  // 处理图片生成完成
  const handleImageGenerated = useCallback((imageResult: ImageResult) => {
    // 保存图片到历史记录
    try {
      const savedImages = localStorage.getItem("chatvortex-image-history");
      const images = savedImages ? JSON.parse(savedImages) : [];

      // 检查是否已存在相同ID的任务
      const existingIndex = images.findIndex(
        (img: ImageResult) => img.id === imageResult.id
      );

      if (existingIndex >= 0) {
        // 更新已存在的任务
        images[existingIndex] = imageResult;
      } else {
        // 添加新任务
        images.unshift(imageResult);
      }

      localStorage.setItem("chatvortex-image-history", JSON.stringify(images));
    } catch (error) {
      console.error("保存图片历史失败:", error);
    }
  }, []);

  // 更新当前会话的布局模式
  const handleUpdateSessionLayout = useCallback(
    async (newLayoutMode: LayoutMode) => {
      if (!currentSessionId) return;

      try {
        const session = await storage.loadSession(currentSessionId);
        if (session) {
          const updatedSession = {
            ...session,
            layoutMode: newLayoutMode,
            updatedAt: new Date(),
          };
          await storage.saveSession(updatedSession);
          setCurrentSession(updatedSession); // 同步更新当前会话状态
          console.log("✅ 布局模式更新成功");
        }
      } catch (error) {
        console.error("❌ 更新布局模式失败:", error);
      }
    },
    [currentSessionId, storage]
  );

  // 回到首页
  const handleBackToHome = useCallback(() => {
    setCurrentSessionId(null);
    setCurrentSession(null);
  }, []);

  // 聚焦输入框
  const focusInput = useCallback(() => {
    if (chatInputRef.current) {
      chatInputRef.current.focusInput();
    }
  }, []);

  // 快捷键动作处理
  const shortcutActions: ShortcutActions = {
    openHistory: () => setShowHistory(true),
    newChat: handleNewChat,
    openSettings: () => setShowSettings(true),
    focusInput: focusInput,
    closeModal: () => {
      if (showHistory) setShowHistory(false);
      else if (showSettings) setShowSettings(false);
      else if (showSessionConfig) setShowSessionConfig(false);
    },
    selectPrevSession: () => {
      // 这些动作在HistoryModal中处理
    },
    selectNextSession: () => {
      // 这些动作在HistoryModal中处理
    },
    deleteCurrentSession: () => {
      if (currentSessionId && currentSession) {
        if (confirm("确定要删除当前会话吗？")) {
          handleDeleteSession(currentSessionId);
        }
      }
    },
  };

  // 使用快捷键Hook
  useKeyboardShortcuts(apiConfig.shortcuts, shortcutActions);

  // 渲染首页
  const renderHomePage = () => {
    return (
      <div className="relative h-full overflow-y-auto p-6 pt-20 pb-40">
        <div className="w-full max-w-6xl mx-auto">
          {/* 欢迎区域 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="text-6xl mb-6">🤖</div>
            <h1 className="text-4xl font-bold gradient-text mb-4">
              ChatVortex AI 智能助手
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              开始与 AI 的智能对话，探索无限可能
            </p>
            <motion.button
              onClick={handleNewChat}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              开始新对话
            </motion.button>
          </motion.div>

          {/* 历史对话列表 */}
          {sessions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-8"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <span>📚</span>
                最近的对话
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.slice(0, 6).map((session, index) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-lg transition-all duration-300 group"
                    whileHover={{ scale: 1.02, y: -5 }}
                    onClick={() => handleSelectSession(session.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-800 truncate flex-1">
                        {session.title}
                      </h3>
                      <div className="text-xs text-gray-500 ml-2">
                        {session.messageCount || 0} 条消息
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {session.lastMessagePreview || "暂无消息"}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{session.updatedAt.toLocaleDateString()}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-400"></span>
                          <span>{session.layoutMode || "timeline"}</span>
                        </div>
                        {session.config?.model && (
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                            <span>
                              {session.config.model
                                .replace("gpt-", "")
                                .replace("claude-", "")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {sessions.length > 6 && (
                <div className="text-center mt-6">
                  <motion.button
                    onClick={() => setShowHistory(true)}
                    className="px-6 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    查看全部 {sessions.length} 个对话
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}

          {/* 功能介绍 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[
              { icon: "🃏", title: "悬浮卡片", desc: "3D立体卡片布局" },
              { icon: "⚡", title: "分屏模式", desc: "左右分屏显示" },
              { icon: "📊", title: "时间轴", desc: "时序对话展示" },
              { icon: "✨", title: "沉浸式", desc: "全屏沉浸体验" },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl p-6 text-center hover:shadow-lg transition-all duration-300"
                whileHover={{ scale: 1.05, y: -5 }}
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    );
  };

  // 渲染不同布局模式的消息
  const renderMessagesLayout = () => {
    // 如果没有选择会话，显示首页
    if (!currentSessionId) {
      return renderHomePage();
    }

    const allMessages = currentSession?.messages || [];
    const messages = getVisibleMessages(allMessages);

    // 如果会话存在但没有消息，显示空状态
    if (allMessages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <div className="text-4xl mb-4">🤖</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            开始新的对话
          </h3>
          <p className="text-gray-500">输入您的第一条消息来开始聊天</p>
        </div>
      );
    }

    // 使用当前会话的布局模式，如果没有设置则使用全局默认的沉浸式
    const sessionLayoutMode = currentSession?.layoutMode || "immersive";

    switch (sessionLayoutMode) {
      case "floating-cards":
        return renderFloatingCards(messages);
      case "split-screen":
        return renderSplitScreen(messages);
      case "timeline":
        return renderTimeline(messages, isNewSessionLoad);
      case "immersive":
        return renderImmersive(messages);
      default:
        return renderImmersive(messages);
    }
  };

  // 1. 悬浮卡片式布局
  const renderFloatingCards = (messages: Message[]) => {
    // 使用传入的消息（已经通过分页处理）
    const visibleMessages = messages;
    const latestMessageIndex = messages.length - 1;

    return (
      <div
        ref={messagesContainerRef}
        className="relative h-full flex items-center justify-center p-8 pt-20 pb-40 overflow-hidden"
      >
        <div className="relative w-full max-w-5xl h-full mx-auto">
          {visibleMessages.map((message, visibleIndex) => {
            const actualIndex = visibleIndex;
            const isUser = message.role === "user";
            // 修复最新消息判断：最新消息应该是visibleMessages的最后一个
            const isLatest = visibleIndex === visibleMessages.length - 1;
            const depth = visibleIndex % 3;

            // 最新消息特殊定位 - 整体向左上移动
            let spiralX, spiralY, zOffset;

            if (isLatest) {
              // 最新消息放在偏右位置，优化计算公式
              const offsetMultiplier = Math.min(messages.length / 8, 1.5); // 调整范围和增长速度
              spiralX = -50 - offsetMultiplier * 15; // 简化公式，基础位置更靠右
              spiralY = -40 + offsetMultiplier * 15; // 向上移动
              zOffset = 300; // 最高层级
            } else {
              // 其他消息使用改进的螺旋分布
              const spiralRadius = 100 + visibleIndex * 20;
              const angle = visibleIndex * 0.8 + (isUser ? 0 : Math.PI);

              spiralX = Math.cos(angle) * spiralRadius;
              spiralY = Math.sin(angle) * spiralRadius;

              // 添加层次感和波浪效果
              const layerOffset = Math.floor(visibleIndex / 6) * 60;
              const waveOffset = Math.sin(visibleIndex * 0.5) * 40;

              // 优化计算公式，让布局更靠近右边，简化复杂的偏移计算
              const offsetMultiplier = Math.min(messages.length / 8, 1.5); // 更平缓的增长
              const baseOffsetX = -80 - offsetMultiplier * 20; // 简化公式，基础位置更靠右
              const baseOffsetY = -20 + offsetMultiplier * 20; // 向上移动

              spiralX =
                spiralX + waveOffset + (isUser ? 20 : -80) + baseOffsetX;
              spiralY =
                spiralY +
                layerOffset -
                visibleMessages.length * 8 +
                baseOffsetY;
              zOffset = depth * 50;
            }

            return (
              <motion.div
                key={message.id}
                className={`absolute ${isLatest ? "z-50" : ""}`}
                style={{
                  left: `calc(50% + ${spiralX}px)`,
                  top: `calc(50% + ${spiralY}px)`,
                  transform: `translate(-50%, -50%) translateZ(${zOffset}px)`,
                  transformStyle: "preserve-3d",
                  zIndex: isLatest ? 999 : 100 + visibleIndex, // 越新的消息（visibleIndex越大）z-index越高
                }}
                initial={{
                  scale: 0,
                  opacity: 0,
                  rotateX: isUser ? 45 : -45,
                  rotateY: isUser ? 20 : -20,
                  z: -300,
                }}
                animate={{
                  scale: isLatest ? 1.1 : 1,
                  opacity: isLatest ? 1 : 0.85,
                  rotateX: Math.sin(visibleIndex * 0.3) * 5,
                  rotateY: Math.cos(visibleIndex * 0.3) * 5,
                  z: zOffset,
                }}
                transition={{
                  delay: visibleIndex * 0.1,
                  type: "spring",
                  damping: 12,
                  stiffness: 80,
                }}
                whileHover={{
                  scale: isLatest ? 1.2 : 1.15,
                  zIndex: 1000,
                  opacity: 1,
                  rotateX: isUser ? -12 : 12,
                  rotateY: isUser ? -12 : 12,
                  z: zOffset + 80,
                  transition: { duration: 0.4, type: "spring" },
                }}
                drag={!isLatest} // 最新消息不可拖拽
                dragConstraints={
                  !isLatest
                    ? {
                        left: -200,
                        right: 200,
                        top: -100,
                        bottom: 100,
                      }
                    : undefined
                }
              >
                <div
                  className={`group relative p-6 max-w-sm backdrop-blur-xl border shadow-lg transition-all duration-300 ${
                    isLatest
                      ? "cursor-pointer hover:shadow-xl"
                      : "cursor-grab active:cursor-grabbing hover:cursor-pointer"
                  } message-bubble ${
                    isLatest
                      ? isUser
                        ? "bg-indigo-600 text-white ring-2 ring-indigo-300 ring-opacity-50"
                        : "bg-white border-indigo-200 text-gray-800 ring-2 ring-indigo-200 ring-opacity-50"
                      : isUser
                        ? "bg-indigo-500 text-white"
                        : "bg-white border-gray-200 text-gray-800"
                  } ${copiedMessageId === message.id ? "ring-2 ring-green-400 ring-opacity-75" : ""}`}
                  style={{
                    clipPath:
                      "polygon(20px 0%, 100% 0%, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0% 100%, 0% 20px)",
                    transformStyle: "preserve-3d",
                  }}
                  onClick={() => handleCopyMessage(message.id, message.content)}
                  title="点击复制消息内容"
                >
                  {/* 最新消息指示器 */}
                  {isLatest && (
                    <motion.div
                      className="absolute -top-2 -right-2 w-10 h-6 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xl"
                      style={{ zIndex: 1000 }}
                      animate={{
                        scale: [1, 1.15, 1],
                        rotate: [0, 5, -5, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      NEW
                    </motion.div>
                  )}

                  {/* 最新消息光晕效果 */}
                  {isLatest && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-lg blur-lg"
                      animate={{
                        opacity: [0.3, 0.7, 0.3],
                        scale: [1, 1.05, 1],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      style={{
                        clipPath:
                          "polygon(20px 0%, 100% 0%, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0% 100%, 0% 20px)",
                      }}
                    />
                  )}
                  {/* 深度阴影 */}
                  <div
                    className={`absolute inset-0 ${isUser ? "bg-cyan-900/40" : "bg-purple-900/40"} blur-sm`}
                    style={{
                      clipPath:
                        "polygon(20px 0%, 100% 0%, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0% 100%, 0% 20px)",
                      transform: "translateZ(-10px) translate(5px, 5px)",
                    }}
                  />

                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <motion.div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                          isUser
                            ? "bg-indigo-500 text-white shadow-lg"
                            : "bg-gray-100 text-gray-600 shadow-lg"
                        }`}
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                      >
                        {isUser ? "👤" : "🤖"}
                      </motion.div>
                      <div className="text-sm font-semibold opacity-90">
                        {isUser ? "You" : "AI Assistant"}
                      </div>
                      <div className="ml-auto text-xs opacity-60">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>

                    <div className="relative mb-3">
                      <div className="text-sm leading-relaxed max-h-32 overflow-y-auto custom-scrollbar pr-1">
                        {isUser || !message.isStreaming ? (
                          <MessageRenderer
                            content={message.content}
                            className={isUser ? "prose-invert text-white" : ""}
                            images={message.images}
                          />
                        ) : (
                          <TypewriterEffect
                            text={message.content}
                            speed={5}
                            className={isUser ? "prose-invert text-white" : ""}
                            isStreaming={message.isStreaming}
                          />
                        )}
                      </div>
                      {/* 底部渐变遮罩，提示内容可滚动 */}
                      {message.content.length > 150 && (
                        <div
                          className={`absolute bottom-0 left-0 right-0 h-6 pointer-events-none ${
                            isLatest
                              ? "bg-gradient-to-t from-indigo-600/60 to-transparent"
                              : isUser
                                ? "bg-gradient-to-t from-indigo-500/60 to-transparent"
                                : "bg-gradient-to-t from-white/80 to-transparent"
                          }`}
                        />
                      )}
                    </div>

                    {/* AI消息操作按钮 */}
                    {!isUser && !message.isStreaming && (
                      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRegenerateMessage(message.id);
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-300/30 rounded-md text-indigo-600 hover:text-indigo-700 text-xs font-medium transition-all duration-200"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          disabled={isLoading}
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          重新生成
                        </motion.button>
                      </div>
                    )}

                    {/* 复制成功指示器 */}
                    {copiedMessageId === message.id && (
                      <motion.div
                        className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg z-20"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        ✓ 已复制
                      </motion.div>
                    )}

                    {/* 3D能量指示器 */}
                    <motion.div
                      className={`absolute top-0 left-0 right-0 h-1 ${
                        isLatest
                          ? "bg-gradient-to-r from-red-400/80 to-pink-500/80"
                          : isUser
                            ? "bg-gradient-to-r from-indigo-400/60 to-indigo-600/60"
                            : "bg-gradient-to-r from-gray-300/60 to-gray-400/60"
                      }`}
                      animate={{
                        scaleX: isLatest ? [0, 1, 1, 0] : [0, 1, 0],
                        opacity: isLatest ? [0.8, 1, 1, 0.8] : [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: isLatest ? 2 : 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: visibleIndex * 0.3,
                      }}
                      style={{ transform: "translateZ(5px)" }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* 中心引力核心 - 增强版 */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
            animate={{
              rotate: 360,
            }}
            transition={{
              rotate: { duration: 30, repeat: Infinity, ease: "linear" },
            }}
          >
            {/* 外层光环 */}
            <motion.div
              className="absolute inset-0 w-24 h-24 -translate-x-1/2 -translate-y-1/2 border-2 border-gray-200/30 rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* 中层光环 */}
            <motion.div
              className="absolute inset-0 w-20 h-20 -translate-x-1/2 -translate-y-1/2 border border-gray-300/40 rounded-full"
              animate={{
                scale: [1.2, 0.8, 1.2],
                rotate: -360,
              }}
              transition={{
                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 15, repeat: Infinity, ease: "linear" },
              }}
            />

            {/* 核心球体 */}
            <motion.div
              className="relative w-16 h-16 bg-gradient-to-br from-indigo-400 via-indigo-500 to-indigo-600 rounded-full shadow-2xl flex items-center justify-center"
              animate={{
                scale: [1, 1.2, 1],
                boxShadow: [
                  "0 0 20px rgba(6, 182, 212, 0.5)",
                  "0 0 40px rgba(6, 182, 212, 0.8)",
                  "0 0 20px rgba(6, 182, 212, 0.5)",
                ],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              whileHover={{
                scale: 1.4,
                transition: { duration: 0.3 },
              }}
            >
              <motion.span
                className="text-white text-2xl"
                animate={{
                  rotate: [0, 180, 360],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                💫
              </motion.span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  };

  // 3. 分屏/多面板布局
  const renderSplitScreen = (messages: Message[]) => {
    const userMessages = messages.filter((m) => m.role === "user");
    const aiMessages = messages.filter((m) => m.role === "assistant");

    return (
      <div
        className="relative h-full flex justify-center"
        style={{
          paddingTop: "102px",
          paddingBottom: "20px",
          paddingRight: "20px",
        }}
      >
        <div className="w-full max-w-6xl mx-auto flex h-full">
          {/* 左侧用户消息面板 */}
          <motion.div
            className="w-2/5 relative p-6 bg-gradient-to-br from-cyan-900/20 to-blue-900/20 backdrop-blur-sm border-r border-gray-200/30 flex flex-col"
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-cyan-300 mb-2">
                👤 Your Messages
              </h3>
              <div className="h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto">
              {userMessages.map((message, index) => (
                <motion.div
                  key={message.id}
                  className={`bg-gradient-to-r from-cyan-600/80 to-blue-600/80 backdrop-blur-xl border border-cyan-400/40 p-4 rounded-2xl text-cyan-50 shadow-lg cursor-pointer hover:shadow-xl relative ${copiedMessageId === message.id ? "ring-2 ring-green-400 ring-opacity-75" : ""}`}
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, x: 10 }}
                  onClick={() => handleCopyMessage(message.id, message.content)}
                  title="点击复制消息内容"
                >
                  <div className="text-sm leading-relaxed">
                    <MessageRenderer
                      content={message.content}
                      className="prose-invert text-cyan-50"
                      images={message.images}
                    />
                  </div>
                  <div className="text-xs opacity-60 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>

                  {/* 复制成功指示器 */}
                  {copiedMessageId === message.id && (
                    <motion.div
                      className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg z-20"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      ✓ 已复制
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* 右侧AI消息面板 */}
          <motion.div
            className="w-3/5 relative p-6 bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-sm flex flex-col"
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-purple-300 mb-2">
                🤖 AI Responses
              </h3>
              <div className="h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent" />
            </div>

            <div
              ref={splitScreenAIRef}
              className="space-y-4 flex-1 overflow-y-auto"
              onScroll={handleScroll}
            >
              {aiMessages.map((message, index) => (
                <motion.div
                  key={message.id}
                  className={`group bg-gradient-to-r from-purple-600/80 to-pink-600/80 backdrop-blur-xl border border-gray-300/40 p-4 rounded-2xl text-purple-50 shadow-lg cursor-pointer hover:shadow-xl relative ${copiedMessageId === message.id ? "ring-2 ring-green-400 ring-opacity-75" : ""}`}
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, x: -10 }}
                  onClick={() => handleCopyMessage(message.id, message.content)}
                  title="点击复制消息内容"
                >
                  <div className="text-sm leading-relaxed">
                    {message.isStreaming ? (
                      <TypewriterEffect
                        text={message.content}
                        speed={5}
                        className="prose-invert text-purple-50"
                        isStreaming={message.isStreaming}
                      />
                    ) : (
                      <MessageRenderer
                        content={message.content}
                        className="prose-invert text-purple-50"
                        images={message.images}
                      />
                    )}
                  </div>
                  <div className="text-xs opacity-60 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>

                  {/* AI消息操作按钮 */}
                  {!message.isStreaming && (
                    <div className="flex items-center justify-end gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRegenerateMessage(message.id);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-300/30 rounded-lg text-purple-300 hover:text-purple-100 text-xs font-medium transition-all duration-200"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isLoading}
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        重新生成
                      </motion.button>
                    </div>
                  )}

                  {/* 复制成功指示器 */}
                  {copiedMessageId === message.id && (
                    <motion.div
                      className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg z-20"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      ✓ 已复制
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  // 4. 时间轴/瀑布流布局
  const renderTimeline = (
    messages: Message[],
    disableAnimations: boolean = false
  ) => (
    <div
      ref={messagesContainerRef}
      className="relative h-full overflow-y-auto p-6 pt-20 pb-40"
      onScroll={handleScroll}
    >
      <div className="w-full max-w-5xl mx-auto relative">
        {/* 顶部加载指示器 */}
        {isLoadingMore && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2"
          >
            <LoadingSpinner size="sm" className="text-white" />
            加载历史消息...
          </motion.div>
        )}
        {/* 消息容器 */}
        <div
          className="relative"
          style={{ minHeight: `${Math.max(messages.length * 120, 400)}px` }}
        >
          {/* 中央时间轴线 */}
          <div
            className="absolute left-1/2 top-0 w-1 bg-gradient-to-b from-gray-300 via-purple-400 to-cyan-400 transform -translate-x-1/2"
            style={{ height: "100%" }}
          />
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const isLeft = isUser; // User messages on the left, assistant messages on the right

            return (
              <motion.div
                key={message.id}
                className={`relative flex items-center mb-8 ${isLeft ? "justify-start" : "justify-end"}`}
                initial={
                  disableAnimations
                    ? false
                    : {
                        opacity: 0,
                        x: isLeft ? -100 : 100,
                        y: 50,
                      }
                }
                animate={{
                  opacity: 1,
                  x: 0,
                  y: 0,
                }}
                transition={
                  disableAnimations
                    ? { duration: 0 }
                    : {
                        delay: index * 0.1, // 减少延迟
                        type: "spring",
                        damping: 20,
                      }
                }
              >
                {/* 时间轴节点 */}
                <motion.div
                  className={`absolute ${isLeft ? "right-1/2 translate-x-1/2" : "left-1/2 -translate-x-1/2"} w-4 h-4 rounded-full border-2 ${
                    isUser
                      ? "bg-cyan-400 border-cyan-300 shadow-lg shadow-indigo-200"
                      : "bg-purple-400 border-purple-300 shadow-lg shadow-purple-400/50"
                  } z-10`}
                  animate={
                    disableAnimations
                      ? {}
                      : {
                          scale: [1, 1.3, 1],
                          boxShadow: [
                            "0 0 10px rgba(6, 182, 212, 0.5)",
                            "0 0 20px rgba(6, 182, 212, 0.8)",
                            "0 0 10px rgba(6, 182, 212, 0.5)",
                          ],
                        }
                  }
                  transition={
                    disableAnimations
                      ? {}
                      : {
                          duration: 3,
                          repeat: Infinity,
                          delay: index * 0.5,
                        }
                  }
                />

                {/* 消息卡片 */}
                <motion.div
                  className={`group w-96 max-w-[45vw] min-w-80 timeline-message ${isLeft ? "mr-1" : "ml-1"}`}
                  data-content-length={
                    message.content.length < 100
                      ? "short"
                      : message.content.length < 300
                        ? "medium"
                        : "long"
                  }
                  whileHover={
                    disableAnimations
                      ? {}
                      : {
                          scale: 1.05,
                          y: -5,
                          transition: { duration: 0.3 },
                        }
                  }
                >
                  <div
                    className={`relative p-4 md:p-5 backdrop-blur-xl border-2 shadow-2xl cursor-pointer hover:shadow-3xl rounded-xl ${
                      isUser
                        ? "bg-gradient-to-br from-cyan-600/90 to-blue-600/90 border-cyan-400/60 text-cyan-50"
                        : "bg-gradient-to-br from-purple-600/90 to-pink-600/90 border-purple-400/60 text-purple-50"
                    } ${copiedMessageId === message.id ? "ring-2 ring-green-400 ring-opacity-75" : ""}`}
                    style={{
                      clipPath: isLeft
                        ? "polygon(0% 0%, calc(100% - 20px) 0%, 100% 20px, 100% 100%, 0% 100%)"
                        : "polygon(20px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 20px)",
                    }}
                    onClick={() =>
                      handleCopyMessage(message.id, message.content)
                    }
                    title="点击复制消息内容"
                  >
                    {/* 重力效果阴影 */}
                    <motion.div
                      className={`absolute inset-0 ${isUser ? "bg-cyan-900/30" : "bg-purple-900/30"} blur-lg`}
                      animate={{
                        y: [0, 3, 0],
                        opacity: [0.3, 0.6, 0.3],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      style={{
                        clipPath: isLeft
                          ? "polygon(0% 0%, calc(100% - 20px) 0%, 100% 20px, 100% 100%, 0% 100%)"
                          : "polygon(20px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 20px)",
                        transform: "translate(3px, 8px)",
                      }}
                    />

                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                            isUser ? "bg-cyan-500" : "bg-purple-500"
                          }`}
                        >
                          {isUser ? "👤" : "🤖"}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">
                            {isUser ? "You" : "AI Assistant"}
                          </div>
                          <div className="text-xs opacity-60">
                            {message.timestamp.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm md:text-base leading-relaxed overflow-wrap-anywhere">
                        {isUser || !message.isStreaming ? (
                          <MessageRenderer
                            content={message.content}
                            className={`${isUser ? "prose-invert text-cyan-50" : "prose-invert text-purple-50"} prose-sm md:prose-base max-w-none`}
                            images={message.images}
                          />
                        ) : (
                          <TypewriterEffect
                            text={message.content}
                            speed={5}
                            className="prose-invert text-purple-50 prose-sm md:prose-base max-w-none"
                            isStreaming={message.isStreaming}
                          />
                        )}
                      </div>

                      {/* AI消息操作按钮 */}
                      {!isUser && !message.isStreaming && (
                        <div className="flex items-center justify-end gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRegenerateMessage(message.id);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-300/30 rounded-lg text-purple-300 hover:text-purple-100 text-xs font-medium transition-all duration-200"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={isLoading}
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            重新生成
                          </motion.button>
                        </div>
                      )}

                      {/* 复制成功指示器 */}
                      {copiedMessageId === message.id && (
                        <motion.div
                          className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg z-20"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          ✓ 已复制
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // 5. 沉浸式全屏布局 - 重新设计为瀑布流
  const renderImmersive = (messages: Message[]) => (
    <div className="relative h-full overflow-hidden">
      {/* 梦幻背景 */}
      <div className="absolute inset-0">
        {/* 渐变背景 */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />

        {/* 浮动气泡 */}
        <div className="absolute inset-0">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-gradient-to-r from-blue-200/20 to-purple-200/20 backdrop-blur-sm"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: Math.random() * 40 + 10,
                height: Math.random() * 40 + 10,
              }}
              animate={{
                y: [0, -15, 0],
                x: [0, Math.random() * 10 - 5, 0],
                scale: [1, 1.05, 1],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>

      {/* 消息流 - 瀑布流布局 */}
      <div
        ref={immersiveRef}
        className="relative h-full overflow-y-auto scrollbar-hide pb-32"
        onScroll={handleScroll}
      >
        <div className="max-w-4xl mx-auto p-6 pt-24">
          <div className="space-y-6">
            {messages.map((message, index) => {
              const isUser = message.role === "user";

              return (
                <motion.div
                  key={message.id}
                  className={`flex ${isUser ? "justify-start" : "justify-end"}`}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: index * 0.05,
                    duration: 0.4,
                    type: "spring",
                    stiffness: 120,
                  }}
                >
                  <div className={`max-w-2xl ${isUser ? "mr-12" : "ml-12"}`}>
                    {/* 消息卡片 */}
                    <motion.div
                      className={`relative p-5 rounded-3xl shadow-lg cursor-pointer group ${
                        isUser
                          ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                          : "bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-800"
                      } ${copiedMessageId === message.id ? "ring-2 ring-green-400" : ""}`}
                      whileHover={{
                        scale: 1.01,
                        y: -3,
                        boxShadow: isUser
                          ? "0 15px 30px rgba(79, 70, 229, 0.25)"
                          : "0 15px 30px rgba(0, 0, 0, 0.08)",
                      }}
                      onClick={() =>
                        handleCopyMessage(message.id, message.content)
                      }
                      title="点击复制消息内容"
                    >
                      {/* 发光效果 */}
                      <motion.div
                        className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 ${
                          isUser ? "bg-white/10" : "bg-blue-500/5"
                        }`}
                        transition={{ duration: 0.3 }}
                      />

                      {/* 消息头部 */}
                      <div className="flex items-center gap-3 mb-3">
                        <motion.div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                            isUser
                              ? "bg-white/20 backdrop-blur-sm"
                              : "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                          }`}
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.5 }}
                        >
                          {isUser ? "👤" : "🤖"}
                        </motion.div>
                        <div>
                          <div
                            className={`font-semibold text-sm ${isUser ? "text-white" : "text-gray-800"}`}
                          >
                            {isUser ? "你" : "AI 助手"}
                          </div>
                          <div
                            className={`text-xs ${isUser ? "text-white/70" : "text-gray-500"}`}
                          >
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>

                      {/* 消息内容 */}
                      <div
                        className={`text-sm leading-relaxed ${isUser ? "text-white" : "text-gray-800"}`}
                      >
                        {isUser || !message.isStreaming ? (
                          <MessageRenderer
                            content={message.content}
                            className={
                              isUser
                                ? "prose-invert text-white"
                                : "text-gray-800"
                            }
                            images={message.images}
                          />
                        ) : (
                          <TypewriterEffect
                            text={message.content}
                            speed={5}
                            className="text-gray-800"
                            isStreaming={message.isStreaming}
                          />
                        )}
                      </div>

                      {/* AI消息操作按钮 */}
                      {!isUser && !message.isStreaming && (
                        <div className="flex items-center justify-end gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRegenerateMessage(message.id);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-300/30 rounded-lg text-indigo-600 hover:text-indigo-700 text-xs font-medium transition-all duration-200"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={isLoading}
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            重新生成
                          </motion.button>
                        </div>
                      )}

                      {/* 复制成功指示器 */}
                      {copiedMessageId === message.id && (
                        <motion.div
                          className="absolute -top-2 -right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                        >
                          ✓ 已复制
                        </motion.div>
                      )}

                      {/* 消息尾巴 */}
                      <div
                        className={`absolute ${
                          isUser
                            ? "left-0 top-6 -translate-x-2"
                            : "right-0 top-6 translate-x-2"
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rotate-45 ${
                            isUser
                              ? "bg-gradient-to-br from-blue-500 to-purple-600"
                              : "bg-white border-l border-t border-gray-200"
                          }`}
                        />
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      <div className="h-screen relative animated-background overflow-hidden">
        {/* 沉浸式背景层 */}
        <div className="absolute inset-0">
          {/* 简化的粒子效果 */}
          <div className="absolute inset-0">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-gray-300/10"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: Math.random() * 3 + 1,
                  height: Math.random() * 3 + 1,
                }}
                animate={{
                  y: [0, -800],
                  opacity: [0, 0.8, 0],
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: Math.random() * 20 + 10,
                  repeat: Infinity,
                  delay: Math.random() * 10,
                  ease: "linear",
                }}
              />
            ))}
          </div>

          {/* 旋转光环 */}
          <motion.div
            className="absolute top-1/2 left-1/2 w-96 h-96 -translate-x-1/2 -translate-y-1/2 border border-gray-200/20 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* 悬浮圆形控制面板 */}
        <motion.div
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`fixed bottom-6 z-50 transition-all duration-500 ease-in-out ${
            isInputCollapsed
              ? "right-6" // 输入框折叠时，设置按钮移到右下角
              : "right-6" // 输入框展开时，设置按钮也在右下角
          }`}
        >
          <div className="group relative">
            {/* 主控制球 */}
            <motion.div
              className="w-12 h-12 glass-effect hover:bg-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              title="布局控制面板 - 悬停查看选项"
            >
              <span className="text-xl">🎛️</span>
            </motion.div>

            {/* 控制面板提示标签 */}
            <motion.div
              className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 0, y: 0 }}
              whileHover={{ opacity: 1, y: -5 }}
            >
              布局设置
            </motion.div>

            {/* 展开的控制选项 */}
            <motion.div
              className="absolute bottom-24 left-0 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              initial={{ x: 0, y: 0 }}
              whileHover={{ x: 0, y: 0 }}
            >
              {/* 新建对话 */}
              <motion.button
                onClick={handleNewChat}
                className="w-10 h-10 rounded-xl shadow-lg flex items-center justify-center text-sm"
                style={{
                  backgroundColor: "#6366f1",
                  color: "white",
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                +
              </motion.button>

              {/* 历史记录 */}
              <motion.button
                onClick={() => setShowHistory(true)}
                className="w-10 h-10 glass-effect hover:bg-blue-50 rounded-xl shadow-lg flex items-center justify-center text-blue-600 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                📚
              </motion.button>

              {/* 图片生成 */}
              <motion.button
                onClick={() => setShowImageGenerator(true)}
                className="w-10 h-10 glass-effect hover:bg-purple-50 rounded-xl shadow-lg flex items-center justify-center text-purple-600 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="AI 图片生成"
              >
                🎨
              </motion.button>

              {/* 图片画廊 */}
              <motion.button
                onClick={() => setShowImageGallery(true)}
                className="w-10 h-10 glass-effect hover:bg-green-50 rounded-xl shadow-lg flex items-center justify-center text-green-600 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="图片画廊"
              >
                🖼️
              </motion.button>

              {/* 设置 */}
              <motion.button
                onClick={() => setShowSettings(true)}
                className="w-10 h-10 glass-effect hover:bg-gray-50 rounded-xl shadow-lg flex items-center justify-center text-gray-600 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                ⚙️
              </motion.button>
            </motion.div>
          </div>
        </motion.div>

        {/* 全屏聊天内容区域 */}
        <div className="absolute inset-0 z-10">
          {/* 聊天内容 - 多布局模式 */}
          <div className="h-full w-full relative">{renderMessagesLayout()}</div>
        </div>

        {/* 悬浮标题栏 - 左对齐 */}
        <div className="fixed top-4 left-4 z-40">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={isMounted ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
            className="glass-effect rounded-2xl shadow-xl px-8 py-4 cursor-pointer hover:bg-white/20 transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            onClick={handleBackToHome}
            title="点击回到首页"
          >
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold gradient-text whitespace-nowrap select-none">
                ChatVortex - AI 智能助手
              </h1>
              {currentSession?.config?.model && (
                <div className="px-2 py-1 bg-blue-500/20 backdrop-blur-sm rounded-full border border-blue-300/30">
                  <span className="text-xs font-medium text-blue-700">
                    {currentSession.config.model
                      .replace("gpt-", "GPT-")
                      .replace("claude-", "Claude ")}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* 布局样式控制面板 - 右边中间 */}
        {currentSession && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="fixed right-6 top-[30%] z-40 flex flex-col gap-3"
          >
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-3 shadow-xl border border-white/20">
              <div className="text-xs text-gray-600 mb-2 text-center font-medium">
                布局样式
              </div>
              <div className="flex flex-col gap-2">
                {[
                  {
                    mode: "floating-cards" as LayoutMode,
                    icon: "🃏",
                    name: "悬浮卡片",
                  },
                  {
                    mode: "split-screen" as LayoutMode,
                    icon: "⚡",
                    name: "分屏模式",
                  },
                  {
                    mode: "timeline" as LayoutMode,
                    icon: "📊",
                    name: "时间轴",
                  },
                  {
                    mode: "immersive" as LayoutMode,
                    icon: "✨",
                    name: "沉浸式",
                  },
                ].map((layout, index) => (
                  <motion.button
                    key={layout.mode}
                    onClick={() => handleUpdateSessionLayout(layout.mode)}
                    className={`w-10 h-10 rounded-xl shadow-md flex items-center justify-center text-sm transition-all ${
                      (currentSession?.layoutMode || "timeline") === layout.mode
                        ? "shadow-indigo-200 ring-2 ring-indigo-300"
                        : "glass-effect text-gray-600 hover:bg-white hover:text-indigo-600 hover:shadow-lg"
                    }`}
                    style={{
                      backgroundColor:
                        (currentSession?.layoutMode || "timeline") ===
                        layout.mode
                          ? "#6366f1"
                          : "rgba(255, 255, 255, 0.8)",
                      color:
                        (currentSession?.layoutMode || "timeline") ===
                        layout.mode
                          ? "white"
                          : undefined,
                    }}
                    whileHover={{ scale: 1.05, x: -2 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ scale: 0, opacity: 0, x: 20 }}
                    animate={{ scale: 1, opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    title={`${layout.name} - 为当前会话设置`}
                  >
                    {layout.icon}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* 会话配置按钮 */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-3 shadow-xl border border-white/20">
              <div className="text-xs text-gray-600 mb-2 text-center font-medium">
                会话设置
              </div>
              <motion.button
                onClick={() => setShowSessionConfig(true)}
                className="w-10 h-10 glass-effect hover:bg-white hover:text-indigo-600 hover:shadow-lg rounded-xl shadow-md flex items-center justify-center text-gray-600 text-sm transition-all"
                whileHover={{ scale: 1.05, x: -2 }}
                whileTap={{ scale: 0.95 }}
                title="配置当前会话的AI模型和参数"
              >
                ⚙️
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* 悬浮输入控制台 */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={isMounted ? { y: 0, opacity: 1 } : { y: 100, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
          className={`fixed bottom-2 z-50 w-full transition-all duration-500 ease-in-out ${
            isInputCollapsed
              ? "left-2" // 折叠时在左边
              : "left-2" // 展开时也在左边（左下角）
          }`}
          style={{ maxWidth: "492px" }} // 512px - 20px = 492px
        >
          <div
            className={`relative ${isInputCollapsed ? "" : "glass-effect rounded-2xl shadow-xl transition-all duration-300"}`}
          >
            <div
              style={{
                padding: isInputCollapsed ? "0px" : "24px",
              }}
              className="transition-all duration-300"
            >
              <ChatInput
                ref={chatInputRef}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                placeholder="输入您的消息..."
                onCollapsedChange={setIsInputCollapsed}
                initialCollapsed={isInputCollapsed}
                currentModel={currentSession?.config?.model || apiConfig.model}
              />
            </div>
          </div>
        </motion.div>

        {/* 设置模态框 */}
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          config={apiConfig}
          onSave={handleSaveSettings}
        />

        {/* 历史记录模态框 */}
        <HistoryModal
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onNewChat={handleNewChat}
        />

        {/* 会话配置模态框 */}
        {currentSession && (
          <SessionConfigModal
            isOpen={showSessionConfig}
            onClose={() => setShowSessionConfig(false)}
            config={currentSession.config || getDefaultSessionConfig()}
            onSave={handleUpdateSessionConfig}
            apiKey={apiConfig.apiKey}
            baseUrl={apiConfig.baseUrl}
          />
        )}

        {/* 图片生成器模态框 */}
        {showImageGenerator && (
          <ImageGenerator
            apiKey={apiConfig.apiKey}
            baseUrl="https://api.gpt.ge"
            onImageGenerated={handleImageGenerated}
            onClose={() => setShowImageGenerator(false)}
          />
        )}

        {/* 图片画廊模态框 */}
        {showImageGallery && (
          <ImageGallery
            apiKey={apiConfig.apiKey}
            baseUrl="https://api.gpt.ge"
            onClose={() => setShowImageGallery(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
