"use client";

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, Square, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export interface ChatInputRef {
  focusInput: () => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({
  onSendMessage,
  isLoading = false,
  placeholder = "输入您的消息...",
  onCollapsedChange,
}, ref) {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 通知父组件折叠状态变化
  const handleCollapsedChange = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapsedChange?.(collapsed);
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 暴露focusInput方法给父组件
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // 如果当前是折叠状态，则展开
        if (isCollapsed) {
          handleCollapsedChange(false);
        }
      }
    }
  }), [isCollapsed, handleCollapsedChange]);

  // 自动调整文本框高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && !isCollapsed) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [message, isCollapsed]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // 这里可以添加语音录制逻辑
  };

  if (isCollapsed) {
    return (
      <div className="flex justify-end w-full">
        <motion.button
          initial={{ opacity: 0, scale: 0.8, x: 50 }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            x: 0,
            boxShadow: "0 8px 20px rgba(99, 102, 241, 0.25)"
          }}
          transition={{ 
            duration: 0.4,
            ease: [0.23, 1, 0.32, 1],
            delay: 0.05
          }}
          type="button"
          onClick={() => handleCollapsedChange(false)}
          className="flex items-center justify-center w-12 h-16 bg-gradient-to-t from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 relative overflow-hidden"
          whileHover={{ 
            scale: 1.05, 
            x: -5,
            boxShadow: "0 15px 35px rgba(99, 102, 241, 0.4)",
            transition: { duration: 0.2 }
          }}
          whileTap={{ 
            scale: 0.95,
            transition: { duration: 0.1 }
          }}
        >
          {/* 光效背景 */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              repeatDelay: 3,
              ease: "linear"
            }}
          />
          
          <motion.div
            animate={{ 
              x: [0, 2, 0],
              transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
            }}
          >
            <ChevronRight size={20} />
          </motion.div>
        </motion.button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        transition: {
          duration: 0.3,
          ease: [0.23, 1, 0.32, 1]
        }
      }}
      exit={{
        opacity: 0,
        scale: 0.95,
        transition: { duration: 0.2 }
      }}
      className="w-full"
    >
      <form onSubmit={handleSubmit} className="relative">
        <motion.div 
          className="flex items-stretch rounded-2xl border border-gray-200 bg-white shadow-sm relative overflow-hidden"
          whileHover={{
            boxShadow: "0 8px 25px rgba(0, 0, 0, 0.12)",
            borderColor: "rgb(165, 180, 252)",
            transition: { duration: 0.2 }
          }}
        >
          {/* 动态边框光效 */}
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.1), transparent)",
              backgroundSize: "200% 100%"
            }}
            animate={{
              backgroundPosition: ["0% 50%", "200% 50%", "0% 50%"]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          
          {/* 折叠按钮 */}
          <motion.button
            type="button"
            onClick={() => handleCollapsedChange(true)}
            className="flex-shrink-0 p-3 rounded-l-2xl bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all duration-200 border-r border-gray-200 relative z-10"
            whileHover={{ 
              scale: 1.05,
              backgroundColor: "rgb(243, 244, 246)",
              transition: { duration: 0.2 }
            }}
            whileTap={{ 
              scale: 0.95,
              transition: { duration: 0.1 }
            }}
          >
            <motion.div
              animate={{ x: [-1, 1, -1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronLeft size={16} />
            </motion.div>
          </motion.button>

          {/* 输入区域 */}
          <div className="flex-1 flex items-end gap-3 p-4 relative z-10">
            {/* 文本输入 */}
            <motion.div 
              className="flex-1 relative"
              animate={{
                scale: isFocused ? 1.02 : 1,
                transition: { duration: 0.2 }
              }}
            >
              <motion.textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                rows={1}
                disabled={isLoading}
                className="w-full bg-transparent border-0 outline-none resize-none text-gray-800 placeholder:text-gray-400 text-sm leading-relaxed py-2 px-0 max-h-[120px] overflow-y-auto transition-all duration-200"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "#cbd5e1 transparent",
                }}
                whileFocus={{
                  scale: 1.01,
                  transition: { duration: 0.2 }
                }}
              />

              {/* 字符计数 */}
              <AnimatePresence>
                {message.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute bottom-1 right-1 text-xs text-gray-400"
                  >
                    {message.length}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* 语音按钮 */}
            <motion.button
              type="button"
              onClick={toggleRecording}
              whileHover={{ 
                scale: 1.05,
                rotate: isRecording ? 0 : 5,
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "p-3 rounded-xl transition-all duration-200 relative overflow-hidden",
                isRecording
                  ? "bg-red-500 text-white shadow-lg shadow-red-200"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              )}
            >
              {isRecording && (
                <motion.div
                  className="absolute inset-0 bg-red-400/30 rounded-xl"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.6, 0.3]
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              )}
              <AnimatePresence mode="wait">
                {isRecording ? (
                  <motion.div
                    key="recording"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Square size={16} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="mic"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Mic size={16} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* 发送按钮 */}
            <motion.button
              type="submit"
              disabled={!message.trim() || isLoading}
              whileHover={{ 
                scale: message.trim() ? 1.05 : 1,
                boxShadow: message.trim() 
                  ? "0 10px 25px rgba(99, 102, 241, 0.3)" 
                  : "none",
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: message.trim() ? 0.95 : 1 }}
              className={cn(
                "p-3 rounded-xl transition-all duration-200 relative overflow-hidden",
                message.trim() && !isLoading
                  ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
            >
              {/* 发送按钮光效 */}
              {message.trim() && !isLoading && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity, 
                    repeatDelay: 2,
                    ease: "linear"
                  }}
                />
              )}
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading-spinner"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1, rotate: 360 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{
                      rotate: {
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      },
                      opacity: { duration: 0.2 },
                      scale: { duration: 0.2 },
                    }}
                  >
                    <Sparkles size={16} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="send-icon"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Send size={16} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>
      </form>
    </motion.div>
  );
});