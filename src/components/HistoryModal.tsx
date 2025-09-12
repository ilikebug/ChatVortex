"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Trash2, Edit3 } from "lucide-react";
import { ChatSession } from "@/types/chat";
import { formatTime } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onNewChat: () => void;
}

export function HistoryModal({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onNewChat,
}: HistoryModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1); // -1 表示新建对话按钮
  const modalRef = useRef<HTMLDivElement>(null);
  const sessionListRef = useRef<HTMLDivElement>(null);
  
  // 排序后的会话列表，用于键盘导航
  const sortedSessions = sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveEdit = (sessionId: string) => {
    if (editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const handleSelectAndClose = (sessionId: string) => {
    onSelectSession(sessionId);
    onClose();
  };

  const handleNewChatAndClose = () => {
    onNewChat();
    onClose();
  };

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      // 模态框打开时，初始选中新建对话按钮
      setSelectedIndex(-1);
      setEditingId(null);
      setEditTitle("");
      
      // 如果有当前会话，选中它
      if (currentSessionId) {
        const currentIndex = sortedSessions.findIndex(s => s.id === currentSessionId);
        if (currentIndex !== -1) {
          setSelectedIndex(currentIndex);
        }
      }
    }
  }, [isOpen, currentSessionId, sortedSessions]);

  // 键盘导航处理
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen || editingId) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.max(-1, prev - 1));
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.min(sortedSessions.length - 1, prev + 1));
        break;
        
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (selectedIndex === -1) {
          handleNewChatAndClose();
        } else if (selectedIndex >= 0 && selectedIndex < sortedSessions.length) {
          handleSelectAndClose(sortedSessions[selectedIndex].id);
        }
        break;
        
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        e.stopPropagation();
        if (selectedIndex >= 0 && selectedIndex < sortedSessions.length) {
          const session = sortedSessions[selectedIndex];
          if (confirm(`确定要删除对话"${session.title}"吗？`)) {
            onDeleteSession(session.id);
            // 调整选中索引
            setSelectedIndex(prev => Math.min(prev, sortedSessions.length - 2));
          }
        }
        break;
        
      case 'F2':
        e.preventDefault();
        e.stopPropagation();
        if (selectedIndex >= 0 && selectedIndex < sortedSessions.length) {
          handleStartEdit(sortedSessions[selectedIndex]);
        }
        break;
    }
  }, [isOpen, editingId, selectedIndex, sortedSessions, onClose, handleNewChatAndClose, handleSelectAndClose, onDeleteSession, handleStartEdit]);

  // 滚动到选中项
  const scrollToSelected = useCallback(() => {
    if (!sessionListRef.current) return;
    
    const container = sessionListRef.current;
    const items = container.querySelectorAll('[data-session-item]');
    
    if (selectedIndex === -1) {
      // 滚动到新建对话按钮
      container.scrollTop = 0;
    } else if (selectedIndex >= 0 && items[selectedIndex]) {
      const selectedItem = items[selectedIndex] as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      const itemRect = selectedItem.getBoundingClientRect();
      
      if (itemRect.top < containerRect.top) {
        selectedItem.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } else if (itemRect.bottom > containerRect.bottom) {
        selectedItem.scrollIntoView({ block: 'end', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // 监听键盘事件
  useEffect(() => {
    if (isOpen) {
      // 使用capture phase来确保模态框的键盘事件比全局快捷键更早处理
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [isOpen, selectedIndex, sortedSessions, editingId, handleKeyDown]);

  // 滚动到选中项
  useEffect(() => {
    if (isOpen) {
      scrollToSelected();
    }
  }, [selectedIndex, isOpen, scrollToSelected]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* 历史记录模态框 */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[101]" data-modal-active="true">
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-[600px] max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            >
              <div className="flex flex-col h-full max-h-[90vh]">
                {/* 头部 */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                      <MessageSquare size={18} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-800">
                        聊天历史
                      </h2>
                      <p className="text-sm text-gray-500">
                        共 {sessions.length} 个对话 • 键盘导航：↑↓ 选择，Enter 确认
                      </p>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X size={18} />
                  </motion.button>
                </div>

                {/* 新建对话按钮 */}
                <div className="p-4 border-b border-gray-200">
                  <motion.button
                    onClick={handleNewChatAndClose}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-white transition-all duration-200 modern-button ${
                      selectedIndex === -1
                        ? "bg-indigo-600 ring-2 ring-indigo-300 ring-opacity-50"
                        : "bg-indigo-500 hover:bg-indigo-600"
                    }`}
                  >
                    <MessageSquare size={18} />
                    <span className="font-medium">新建对话</span>
                    {selectedIndex === -1 && (
                      <motion.div
                        className="ml-auto text-xs bg-white/20 px-2 py-1 rounded-full"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        已选中
                      </motion.div>
                    )}
                  </motion.button>
                </div>

                {/* 历史记录列表 */}
                <div ref={sessionListRef} className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                  {sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                      <MessageSquare size={48} className="text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium text-gray-600 mb-2">
                        还没有聊天记录
                      </h3>
                      <p className="text-sm text-gray-500">
                        开始您的第一次对话吧！
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-2">
                      {sortedSessions.map((session, index) => (
                          <motion.div
                            key={session.id}
                            data-session-item
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`group relative p-4 rounded-xl border transition-all duration-200 hover-lift cursor-pointer ${
                              selectedIndex === index
                                ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200 ring-opacity-50"
                                : currentSessionId === session.id
                                ? "bg-indigo-50 border-indigo-200 shadow-md"
                                : "bg-white border-gray-200 hover:border-gray-300"
                            }`}
                            onClick={() => handleSelectAndClose(session.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                {editingId === session.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={editTitle}
                                      onChange={(e) =>
                                        setEditTitle(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          handleSaveEdit(session.id);
                                        } else if (e.key === "Escape") {
                                          handleCancelEdit();
                                        }
                                      }}
                                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-indigo-500"
                                      autoFocus
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveEdit(session.id);
                                      }}
                                      className="px-2 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                    >
                                      保存
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelEdit();
                                      }}
                                      className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                    >
                                      取消
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <h3 className="font-medium text-gray-900 mb-1 truncate">
                                      {session.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-2">
                                      {session.messageCount || 0} 条消息 ·{" "}
                                      {formatTime(session.updatedAt)}
                                    </p>
                                    {session.lastMessagePreview && (
                                      <p className="text-xs text-gray-400 truncate">
                                        {session.lastMessagePreview}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>

                              {editingId !== session.id && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEdit(session);
                                    }}
                                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                                  >
                                    <Edit3 size={14} />
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm("确定要删除这个对话吗？")) {
                                        onDeleteSession(session.id);
                                      }
                                    }}
                                    className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
                                  >
                                    <Trash2 size={14} />
                                  </motion.button>
                                </div>
                              )}
                            </div>

                            {/* 当前会话指示器 */}
                            {currentSessionId === session.id && (
                              <div className="absolute inset-0 border-2 border-indigo-400 rounded-xl pointer-events-none" />
                            )}
                            
                            {/* 键盘选中指示器 */}
                            {selectedIndex === index && (
                              <motion.div
                                className="absolute top-2 right-2 px-2 py-1 bg-blue-500 text-white text-xs rounded-full font-medium"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2 }}
                              >
                                已选中
                              </motion.div>
                            )}
                          </motion.div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
