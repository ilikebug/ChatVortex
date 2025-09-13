"use client";

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, Square, Sparkles, ChevronLeft, ChevronRight, MicOff, Languages } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  initialCollapsed?: boolean;
}

export interface ChatInputRef {
  focusInput: () => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({
  onSendMessage,
  isLoading = false,
  placeholder = "输入您的消息...",
  onCollapsedChange,
  initialCollapsed = false,
}, ref) {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState('zh-CN'); // 默认中文
  const [micLevel, setMicLevel] = useState(0); // 麦克风音量级别
  const recognitionRef = useRef<any>(null); // 使用any类型避免TypeScript错误
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // 通知父组件折叠状态变化
  const handleCollapsedChange = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapsedChange?.(collapsed);
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 初始化语音识别
  const initializeSpeechRecognition = useCallback(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      console.log('🔍 SpeechRecognition available:', !!SpeechRecognition);
      
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true; // 使用连续模式
        recognition.interimResults = true; // 启用临时结果
        recognition.lang = speechLang; // 使用动态语言设置
        recognition.maxAlternatives = 1;
        
        console.log('🎤 Speech recognition initialized with settings:', {
          continuous: recognition.continuous,
          interimResults: recognition.interimResults,
          lang: recognition.lang
        });
        
        recognition.onstart = () => {
          setIsListening(true);
          console.log('🎤 语音识别开始');
        };
        
        recognition.onresult = (event) => {
          console.log('🎯 Speech recognition result event:', event);
          let finalTranscript = '';
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const confidence = event.results[i][0].confidence;
            console.log(`📝 Result ${i}: "${transcript}" (final: ${event.results[i].isFinal}, confidence: ${confidence})`);
            
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }
          
          console.log('📊 Transcripts - Interim:', interimTranscript, 'Final:', finalTranscript);
          
          // 实时显示临时结果
          if (interimTranscript) {
            console.log('⚡ Updating with interim result:', interimTranscript);
            setMessage(prev => {
              // 移除之前的临时文本（如果有的话）
              const cleanPrev = prev.replace(/\s*\[临时识别\].*$/, '');
              return cleanPrev + (cleanPrev ? ' ' : '') + '[临时识别]' + interimTranscript;
            });
          }
          
          if (finalTranscript) {
            console.log('✅ Processing final result:', finalTranscript);
            // 基本的标点符号处理
            let processedText = finalTranscript.trim();
            
            // 英文不需要特殊标点处理，中文才需要
            if (recognition.lang === 'zh-CN' && processedText && !processedText.match(/[.!?。！？]$/)) {
              // 如果是疑问词开头，加问号
              if (processedText.match(/^(什么|怎么|为什么|哪里|谁|何时|多少|如何)/)) {
                processedText += '？';
              } else {
                processedText += '。';
              }
            }
            
            setMessage(prev => {
              // 移除临时标记文本，添加最终结果
              const cleanPrev = prev.replace(/\s*\[临时识别\].*$/, '');
              const newMessage = cleanPrev + (cleanPrev ? ' ' : '') + processedText;
              console.log('💬 Final message updated to:', newMessage);
              return newMessage;
            });
            
            // 在连续模式下，处理完最终结果后清理临时状态，准备接收新的语音
            console.log('🔄 准备接收下一段语音...');
          }
        };
        
        recognition.onerror = (event) => {
          console.error('🚫 语音识别错误:', event.error);
          
          // 根据错误类型给出不同的提示和处理
          if (event.error === 'no-speech') {
            console.log('💡 提示: 没有检测到语音，尝试重新启动识别...');
            // 短暂延迟后自动重启（如果用户仍在录音状态）
            setTimeout(() => {
              if (isRecording && recognitionRef.current) {
                console.log('🔄 自动重启语音识别...');
                try {
                  recognitionRef.current.start();
                } catch (error) {
                  console.error('重启失败:', error);
                  setIsRecording(false);
                  setIsListening(false);
                }
              }
            }, 100);
            return; // 不要设置停止状态
          } else if (event.error === 'not-allowed') {
            console.error('❌ 麦克风权限被拒绝，请在浏览器设置中允许麦克风访问');
          } else if (event.error === 'audio-capture') {
            console.error('❌ 无法捕获音频，请检查麦克风是否正常工作');
          } else {
            console.error('❌ 其他错误:', event.error);
          }
          
          // 对于非 no-speech 错误才停止录音
          setIsRecording(false);
          setIsListening(false);
          
          // 清理临时识别文本
          setMessage(prev => prev.replace(/\s*\[临时识别\].*$/, ''));
        };
        
        recognition.onend = () => {
          console.log('🎤 语音识别结束');
          setIsListening(false);
          
          // 连续模式下如果用户还在录音状态，短暂延迟后自动重启
          if (isRecording && recognitionRef.current) {
            console.log('🔄 连续模式：延迟500ms后重启，等待新的语音输入...');
            setTimeout(() => {
              if (isRecording && recognitionRef.current) {
                try {
                  setIsListening(true);
                  recognitionRef.current.start();
                  console.log('✨ 语音识别重新启动，等待下一段语音...');
                } catch (error) {
                  console.error('连续重启失败:', error);
                  setIsRecording(false);
                  setIsListening(false);
                }
              }
            }, 500); // 增加延迟时间给用户说话的间隙
          } else {
            setIsRecording(false);
            
            // 清理临时识别文本
            setMessage(prev => prev.replace(/\s*\[临时识别\].*$/, ''));
          }
        };
        
        recognitionRef.current = recognition;
      } else {
        setSpeechSupported(false);
        console.warn('⚠️ 浏览器不支持语音识别功能');
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [speechLang]); // 当语言改变时重新初始化

  // 初始化和语言变化时重新初始化语音识别
  useEffect(() => {
    initializeSpeechRecognition();
  }, [initializeSpeechRecognition]);

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

  // 切换语音识别语言
  const toggleSpeechLanguage = () => {
    const newLang = speechLang === 'zh-CN' ? 'en-US' : 'zh-CN';
    setSpeechLang(newLang);
    console.log('🌐 语音识别语言切换为:', newLang === 'zh-CN' ? '中文' : '英文');
  };

  // 启动麦克风音量监测
  const startMicrophoneMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (!analyserRef.current || !isRecording) return;
        
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, value) => a + value, 0);
        const average = sum / dataArray.length;
        const level = Math.min(100, Math.round(average));
        
        setMicLevel(level);
        console.log('🎵 麦克风音量级别:', level);
        
        if (isRecording) {
          requestAnimationFrame(updateLevel);
        }
      };
      
      updateLevel();
      return stream;
    } catch (error) {
      console.error('❌ 麦克风监测启动失败:', error);
      return null;
    }
  };

  // 检查麦克风权限
  const checkMicrophonePermission = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('🎤 麦克风权限检查通过');
        stream.getTracks().forEach(track => track.stop()); // 释放资源
        return true;
      }
    } catch (error) {
      console.error('❌ 麦克风权限检查失败:', error);
      return false;
    }
    return false;
  };

  const toggleRecording = async () => {
    console.log('🎙️ Toggle recording called. Current state:', { 
      speechSupported, 
      hasRecognition: !!recognitionRef.current, 
      isRecording, 
      isListening 
    });
    
    if (!speechSupported || !recognitionRef.current) {
      console.warn('⚠️ 语音识别不可用');
      return;
    }

    if (isRecording || isListening) {
      console.log('🛑 Stopping speech recognition...');
      // 停止录音
      recognitionRef.current.stop();
      setIsRecording(false);
      
      // 清理临时识别文本
      setTimeout(() => {
        setMessage(prev => prev.replace(/\s*\[临时识别\].*$/, ''));
      }, 100);
    } else {
      // 开始录音前先检查麦克风权限
      console.log('🔍 检查麦克风权限...');
      const hasPermission = await checkMicrophonePermission();
      
      if (!hasPermission) {
        console.error('❌ 麦克风权限不足，请允许浏览器访问麦克风');
        return;
      }
      
      console.log('🎬 Starting speech recognition...');
      try {
        setIsRecording(true);
        
        // 启动麦克风监测
        await startMicrophoneMonitoring();
        
        recognitionRef.current.start();
        console.log('✅ Speech recognition started successfully');
      } catch (error) {
        console.error('🚫 语音识别启动失败:', error);
        setIsRecording(false);
      }
    }
  };

  if (isCollapsed) {
    return (
      <div className="flex justify-start w-full">
        <motion.button
          initial={{ opacity: 0, scale: 0.8, x: -50 }}
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
            x: 5,
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
      <div className="relative">
        {/* 外部控制按钮 */}
        <div className="flex items-center gap-2 mb-2 relative">
          {/* 折叠按钮 */}
          <motion.button
            type="button"
            onClick={() => handleCollapsedChange(true)}
            className="flex-shrink-0 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-all duration-200"
            whileHover={{ 
              scale: 1.05,
              transition: { duration: 0.2 }
            }}
            whileTap={{ 
              scale: 0.95,
              transition: { duration: 0.1 }
            }}
            title="折叠输入框"
          >
            <ChevronLeft size={16} />
          </motion.button>

          {/* 语言切换按钮 */}
          {speechSupported && (
            <motion.button
              type="button"
              onClick={toggleSpeechLanguage}
              disabled={isLoading || isRecording || isListening}
              whileHover={{ 
                scale: 1.05,
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "p-2 rounded-lg transition-all duration-200 text-xs font-medium",
                isRecording || isListening
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-indigo-100 hover:bg-indigo-200 text-indigo-700"
              )}
              title={`切换到${speechLang === 'zh-CN' ? '英文' : '中文'}识别`}
            >
              {speechLang === 'zh-CN' ? '中' : 'EN'}
            </motion.button>
          )}

          {/* 语音按钮 */}
          <motion.button
            type="button"
            onClick={toggleRecording}
            disabled={!speechSupported || isLoading}
            whileHover={speechSupported ? { 
              scale: 1.05,
              rotate: isRecording ? 0 : 5,
              transition: { duration: 0.2 }
            } : {}}
            whileTap={speechSupported ? { scale: 0.95 } : {}}
            className={cn(
              "p-2 rounded-lg transition-all duration-200 relative overflow-hidden",
              !speechSupported
                ? "bg-gray-100 text-gray-400 cursor-not-allowed opacity-50"
                : isRecording || isListening
                ? "bg-red-500 text-white shadow-lg shadow-red-200"
                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
            )}
            title={
              !speechSupported 
                ? "您的浏览器不支持语音识别功能"
                : isRecording || isListening 
                ? "点击停止录音" 
                : `点击开始语音输入 (${speechLang === 'zh-CN' ? '中文' : '英文'})`
            }
          >
            {isRecording && (
              <motion.div
                className="absolute inset-0 bg-red-400/30 rounded-lg"
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
              {!speechSupported ? (
                <motion.div
                  key="disabled"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <MicOff size={16} />
                </motion.div>
              ) : isRecording || isListening ? (
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

          {/* 语音状态指示器 - 紧贴语音按钮右侧 */}
          {(isRecording || isListening) && (
            <motion.div
              className="flex items-center"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2 shadow-lg">
                <motion.div
                  className="w-2 h-2 bg-white rounded-full"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [1, 0.7, 1]
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                {isListening ? "正在录音..." : "等待语音..."}
                {micLevel > 0 && (
                  <span className="text-xs opacity-80">
                    🎵{micLevel}
                  </span>
                )}
                <span className="text-xs opacity-60">
                  ({speechLang === 'zh-CN' ? '中文' : '英文'})
                </span>
              </div>
            </motion.div>
          )}
        </div>

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
      </div>
    </motion.div>
  );
});