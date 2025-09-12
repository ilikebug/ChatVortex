"use client";

import { motion } from "framer-motion";
import { Bot, User, ChevronDown, ChevronUp } from "lucide-react";
import { Message } from "@/types/chat";
import { cn, formatTime } from "@/lib/utils";
import { useState } from "react";
import { MessageRenderer } from "./MessageRenderer";
import { TypewriterEffect } from "./TypewriterEffect";

interface ChatMessageProps {
  message: Message;
  isLast?: boolean;
}

export function ChatMessage({ message, isLast }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isTyping = message.isTyping;

  // 长内容处理
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongContent =
    message.content.length > 500 || message.content.split("\n").length > 8;
  const shouldTruncate = isLongContent && !isExpanded;

  // 检测内容类型
  const hasCodeBlocks =
    message.content.includes("```") || message.content.includes("`");
  const hasList =
    message.content.includes("\n- ") ||
    message.content.includes("\n* ") ||
    /\n\d+\.\s/.test(message.content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex gap-3 mb-6 group",
        isUser ? "flex-row-reverse" : "flex-row",
        isLast && "mb-0"
      )}
    >
      {/* 头像 */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        className="relative flex-shrink-0"
      >
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shadow-lg hover-lift",
            isUser ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-600"
          )}
        >
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>
      </motion.div>

      {/* 消息内容 */}
      <div
        className={cn(
          "flex-1",
          isLongContent ? "max-w-[85%]" : "max-w-[70%]",
          isUser && "flex justify-end"
        )}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className={cn(
            "relative px-4 py-3 message-bubble hover-lift",
            isUser
              ? "bg-indigo-500 text-white ml-auto"
              : "bg-white border border-gray-200 text-gray-800 shadow-md",
            isExpanded && "max-h-[60vh] overflow-y-auto custom-scrollbar"
          )}
        >
          {/* 消息文本 */}
          <div className="relative z-10">
            {isTyping ? (
              <div className="typing-indicator py-2">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className={cn(
                    "text-sm leading-relaxed",
                    shouldTruncate && "max-h-32 overflow-hidden relative"
                  )}
                >
                  {isUser || !message.isStreaming ? (
                    <MessageRenderer 
                      content={shouldTruncate ? message.content.slice(0, 300) + "..." : message.content}
                      className={isUser ? "prose-invert" : ""}
                    />
                  ) : (
                    <TypewriterEffect
                      text={shouldTruncate ? message.content.slice(0, 300) + "..." : message.content}
                      speed={5}
                      className={isUser ? "prose-invert" : ""}
                      disabled={shouldTruncate} // 截断状态下禁用打字机效果
                      isStreaming={message.isStreaming} // 传递流式状态
                    />
                  )}

                  {/* 渐变遮罩 */}
                  {shouldTruncate && (
                    <div
                      className={cn(
                        "absolute bottom-0 left-0 right-0 h-8 pointer-events-none",
                        isUser
                          ? "bg-gradient-to-t from-cyan-600/80 to-transparent"
                          : "bg-gradient-to-t from-slate-700/80 to-transparent"
                      )}
                    />
                  )}
                </motion.div>

                {/* 内容类型标识和展开/收起按钮 */}
                <div className="flex items-center justify-between">
                  {/* 内容类型标识 */}
                  {(hasCodeBlocks || hasList) && (
                    <div className="flex items-center gap-1">
                      {hasCodeBlocks && (
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded text-opacity-80",
                            isUser
                              ? "bg-cyan-500/30 text-cyan-100"
                              : "bg-purple-500/30 text-purple-100"
                          )}
                        >
                          代码
                        </span>
                      )}
                      {hasList && (
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded text-opacity-80",
                            isUser
                              ? "bg-blue-500/30 text-blue-100"
                              : "bg-slate-500/30 text-slate-100"
                          )}
                        >
                          列表
                        </span>
                      )}
                    </div>
                  )}

                  {/* 展开/收起按钮 */}
                  {isLongContent && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      onClick={() => setIsExpanded(!isExpanded)}
                      className={cn(
                        "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all duration-200 hover:scale-105",
                        isUser
                          ? "text-cyan-200 hover:text-cyan-100 bg-cyan-500/20 hover:bg-cyan-500/30"
                          : "text-purple-200 hover:text-purple-100 bg-purple-500/20 hover:bg-purple-500/30"
                      )}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={12} />
                          收起
                        </>
                      ) : (
                        <>
                          <ChevronDown size={12} />
                          展开全部 ({message.content.length} 字符)
                        </>
                      )}
                    </motion.button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 消息时间 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={cn(
              "text-xs mt-1 opacity-60",
              isUser ? "text-right text-blue-100" : "text-left text-gray-400"
            )}
          >
            {formatTime(message.timestamp)}
          </motion.div>

          {/* 发光效果 */}
          <motion.div
            className={cn(
              "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-300",
              isUser
                ? "bg-gradient-to-br from-blue-400 to-purple-500"
                : "bg-gradient-to-br from-emerald-400 to-teal-500"
            )}
            animate={{ opacity: [0, 0.1, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
