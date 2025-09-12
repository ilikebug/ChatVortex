"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Eye, EyeOff, Zap, Sliders, Key, Keyboard, ToggleLeft, ToggleRight, RefreshCw, Trash2 } from "lucide-react";
import { APIConfig, fetchAvailableModels, ModelInfo, getDefaultShortcutsConfig, clearModelsCache, getModelsCacheInfo } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { KeyboardShortcut, ShortcutsConfig } from "@/types/chat";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: APIConfig;
  onSave: (config: APIConfig) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  config,
  onSave,
}: SettingsModalProps) {
  const [formData, setFormData] = useState<APIConfig>(config);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'api' | 'shortcuts'>('api');
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const [modelsCacheInfo, setModelsCacheInfo] = useState(getModelsCacheInfo());

  useEffect(() => {
    setFormData({
      ...config,
      shortcuts: config.shortcuts || getDefaultShortcutsConfig()
    });
  }, [config]);

  // 获取模型列表
  useEffect(() => {
    if (isOpen && formData.apiKey && formData.baseUrl) {
      setIsLoadingModels(true);
      setModelError(null);
      
      fetchAvailableModels(formData.apiKey, formData.baseUrl)
        .then(models => {
          setAvailableModels(models);
        })
        .catch(error => {
          console.error('❌ 系统设置获取模型列表失败:', error);
          setModelError(error.message || '获取模型列表失败');
          // 使用默认模型列表作为备选
          setAvailableModels([
            { id: 'gpt-3.5-turbo', object: 'model', created: 0, owned_by: 'openai' },
            { id: 'gpt-4', object: 'model', created: 0, owned_by: 'openai' },
            { id: 'gpt-4-turbo', object: 'model', created: 0, owned_by: 'openai' },
            { id: 'gpt-4o', object: 'model', created: 0, owned_by: 'openai' },
          ]);
        })
        .finally(() => {
          setIsLoadingModels(false);
          // 更新缓存信息
          setModelsCacheInfo(getModelsCacheInfo());
        });
    }
  }, [isOpen, formData.apiKey, formData.baseUrl]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      onSave(formData);
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 1000);
    } catch (error) {
      setIsSaving(false);
    }
  };

  // 获取模型描述
  const getModelDescription = (modelId: string): string => {
    if (modelId.includes('gpt-5')) return 'OpenAI 最新旗舰模型';
    if (modelId.includes('gpt-4o')) return 'GPT-4 优化版本';
    if (modelId.includes('gpt-4')) return 'GPT-4 系列模型';
    if (modelId.includes('o1') || modelId.includes('o3')) return 'OpenAI 推理模型';
    if (modelId.includes('claude-sonnet-4')) return 'Claude 4 Sonnet';
    if (modelId.includes('claude-3-7')) return 'Claude 3.7 高级模型';
    if (modelId.includes('claude-3-5')) return 'Claude 3.5 优化版';
    if (modelId.includes('claude')) return 'Anthropic Claude 模型';
    if (modelId.includes('gpt-3.5')) return '快速且经济的选择';
    return '聊天对话模型';
  };

  // 获取模型显示名称
  const getModelLabel = (modelId: string): string => {
    if (modelId === 'gpt-3.5-turbo') return 'GPT-3.5 Turbo';
    if (modelId === 'gpt-4') return 'GPT-4';
    if (modelId === 'gpt-4o') return 'GPT-4o';
    if (modelId === 'gpt-4o-mini') return 'GPT-4o Mini';
    if (modelId === 'gpt-4-turbo') return 'GPT-4 Turbo';
    if (modelId.includes('gpt-5')) return modelId.replace('gpt-5', 'GPT-5');
    if (modelId.includes('o1')) return modelId.replace('o1', 'O1');
    if (modelId.includes('o3')) return modelId.replace('o3', 'O3');
    if (modelId.includes('claude')) return modelId.replace('claude-', 'Claude ');
    return modelId.toUpperCase();
  };

  // 过滤模型
  const filteredModels = availableModels.filter(model => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const modelLabel = getModelLabel(model.id).toLowerCase();
    const modelDescription = getModelDescription(model.id).toLowerCase();
    const ownedBy = model.owned_by.toLowerCase();
    
    return (
      model.id.toLowerCase().includes(query) ||
      modelLabel.includes(query) ||
      modelDescription.includes(query) ||
      ownedBy.includes(query)
    );
  });

  // 搜索结果高亮
  const highlightSearchTerm = (text: string, query: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 rounded px-1">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // 快捷键处理函数
  const updateShortcutConfig = (updatedConfig: ShortcutsConfig) => {
    setFormData(prev => ({
      ...prev,
      shortcuts: updatedConfig
    }));
  };

  const toggleShortcutsEnabled = () => {
    if (!formData.shortcuts) return;
    updateShortcutConfig({
      ...formData.shortcuts,
      enabled: !formData.shortcuts.enabled
    });
  };

  const toggleShortcut = (shortcutId: string) => {
    if (!formData.shortcuts) return;
    
    const updatedShortcuts = formData.shortcuts.shortcuts.map(shortcut =>
      shortcut.id === shortcutId
        ? { ...shortcut, enabled: !shortcut.enabled }
        : shortcut
    );
    
    updateShortcutConfig({
      ...formData.shortcuts,
      shortcuts: updatedShortcuts
    });
  };

  const updateShortcutKeys = (shortcutId: string, newKeys: string) => {
    if (!formData.shortcuts) return;
    
    const updatedShortcuts = formData.shortcuts.shortcuts.map(shortcut =>
      shortcut.id === shortcutId
        ? { ...shortcut, keys: newKeys }
        : shortcut
    );
    
    updateShortcutConfig({
      ...formData.shortcuts,
      shortcuts: updatedShortcuts
    });
  };

  const resetShortcuts = () => {
    updateShortcutConfig(getDefaultShortcutsConfig());
  };

  const getShortcutDisplay = (keys: string): string => {
    const isMac = typeof window !== 'undefined' && /macintosh|mac os x/i.test(navigator.userAgent);
    return keys
      .replace(/Cmd/g, isMac ? '⌘' : 'Ctrl')
      .replace(/Ctrl/g, isMac ? '⌃' : 'Ctrl')
      .replace(/Shift/g, isMac ? '⇧' : 'Shift')
      .replace(/Alt/g, isMac ? '⌥' : 'Alt')
      .replace(/ArrowUp/g, '↑')
      .replace(/ArrowDown/g, '↓')
      .replace(/ArrowLeft/g, '←')
      .replace(/ArrowRight/g, '→')
      .replace(/Escape/g, 'Esc')
      .replace(/Backspace/g, isMac ? '⌫' : 'Backspace');
  };

  // 快捷键录制处理
  const handleKeyRecord = (event: React.KeyboardEvent, shortcutId: string) => {
    if (!isRecordingKey || editingShortcut !== shortcutId) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const keys = [];
    const isMac = typeof window !== 'undefined' && /macintosh|mac os x/i.test(navigator.userAgent);
    
    if (event.ctrlKey) keys.push('Ctrl');
    if (event.metaKey) keys.push(isMac ? 'Cmd' : 'Ctrl');
    if (event.shiftKey) keys.push('Shift');
    if (event.altKey) keys.push('Alt');
    
    let mainKey = event.key;
    if (mainKey === ' ') mainKey = 'Space';
    if (mainKey !== 'Control' && mainKey !== 'Meta' && mainKey !== 'Shift' && mainKey !== 'Alt') {
      keys.push(mainKey);
    }
    
    if (keys.length > 1 || ['Escape', 'Enter', 'Space'].includes(mainKey)) {
      const keyString = keys.join('+');
      updateShortcutKeys(shortcutId, keyString);
      setIsRecordingKey(false);
      setEditingShortcut(null);
    }
  };

  const startRecordingKey = (shortcutId: string) => {
    setEditingShortcut(shortcutId);
    setIsRecordingKey(true);
  };

  const cancelRecording = () => {
    setIsRecordingKey(false);
    setEditingShortcut(null);
  };

  // 刷新模型列表
  const handleRefreshModels = () => {
    clearModelsCache();
    setModelsCacheInfo(getModelsCacheInfo());
    // 重新获取模型列表
    if (formData.apiKey && formData.baseUrl) {
      setIsLoadingModels(true);
      setModelError(null);
      fetchAvailableModels(formData.apiKey, formData.baseUrl)
        .then(models => {
          setAvailableModels(models);
        })
        .catch(error => {
          console.error('❌ 刷新模型列表失败:', error);
          setModelError(error.message || '刷新模型列表失败');
        })
        .finally(() => {
          setIsLoadingModels(false);
          setModelsCacheInfo(getModelsCacheInfo());
        });
    }
  };

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

          {/* 模态框 */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[101]" data-modal-active="true">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-[600px] max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            >
              <div className="flex flex-col h-full max-h-[90vh]">
                {/* 头部 */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                      <Sliders size={18} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-800">
                        系统设置
                      </h2>
                      <p className="text-sm text-gray-500">配置您的AI助手</p>
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

                {/* 标签页导航 */}
                <div className="px-6 border-b border-gray-200">
                  <div className="flex space-x-8">
                    <motion.button
                      onClick={() => setActiveTab('api')}
                      className={cn(
                        "pb-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors",
                        activeTab === 'api'
                          ? "border-indigo-500 text-indigo-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Key size={16} />
                      API 配置
                    </motion.button>
                    <motion.button
                      onClick={() => setActiveTab('shortcuts')}
                      className={cn(
                        "pb-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors",
                        activeTab === 'shortcuts'
                          ? "border-indigo-500 text-indigo-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Keyboard size={16} />
                      快捷键设置
                    </motion.button>
                  </div>
                </div>

                {/* 内容 */}
                <div className="flex-1 p-6 overflow-y-auto min-h-0">
                  <AnimatePresence mode="wait">
                    {activeTab === 'api' ? (
                      <motion.div
                        key="api"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                      >
                        {/* API配置 */}
                        <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Key size={16} className="text-primary" />
                        <h3 className="font-medium">API 配置</h3>
                      </div>

                      {/* API Key */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">API Key</label>
                        <div className="relative">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={formData.apiKey}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                apiKey: e.target.value,
                              }))
                            }
                            placeholder="请输入您的API Key"
                            className="w-full p-3 pr-12 rounded-lg modern-input bg-white border border-gray-300 focus:border-indigo-500 focus:outline-none transition-colors text-gray-800 placeholder:text-gray-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted/50 rounded transition-colors"
                          >
                            {showApiKey ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        </div>
                        <div className="text-xs space-y-1">
                          <p className="text-muted-foreground">
                            🔒 您的API Key将安全存储在本地，不会上传到服务器
                          </p>
                          <p className="text-amber-600">
                            ⚠️ 请妥善保管您的API Key，不要与他人分享
                          </p>
                        </div>
                      </div>

                      {/* API Base URL */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">API 地址</label>
                        <input
                          type="text"
                          value={formData.baseUrl}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              baseUrl: e.target.value,
                            }))
                          }
                          placeholder="https://api.openai.com/v1"
                          className="w-full p-3 rounded-lg modern-input bg-white border border-gray-300 focus:border-indigo-500 focus:outline-none transition-colors text-gray-800 placeholder:text-gray-400"
                        />
                      </div>
                    </div>

                    {/* 模型配置 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Zap size={16} className="text-primary" />
                        <h3 className="font-medium">模型配置</h3>
                      </div>

                      {/* 模型选择 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">模型</label>
                          <div className="flex items-center gap-2">
                            {/* 缓存信息 */}
                            {modelsCacheInfo.isCached && (
                              <div className="text-xs text-green-600 flex items-center gap-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                缓存 {modelsCacheInfo.totalModels} 个模型 • 剩余 {modelsCacheInfo.remainingHours}h
                              </div>
                            )}
                            
                            {/* 刷新按钮 */}
                            <motion.button
                              type="button"
                              onClick={handleRefreshModels}
                              disabled={isLoadingModels}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              title="刷新模型列表"
                            >
                              <RefreshCw size={14} className={isLoadingModels ? 'animate-spin' : ''} />
                            </motion.button>
                            
                            {isLoadingModels && (
                              <div className="text-xs text-blue-600 flex items-center gap-1">
                                <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                加载中...
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 搜索框 */}
                        {availableModels.length > 0 && (
                          <div className="mb-3">
                            <div className="relative">
                              <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索模型名称、提供商或描述..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                              />
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                              </div>
                              {searchQuery && (
                                <button
                                  onClick={() => setSearchQuery("")}
                                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                  <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {modelError && (
                          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="text-xs text-yellow-700">
                              ⚠️ {modelError}，使用默认模型列表
                            </div>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                          {filteredModels.length > 0 ? (
                            <>
                              {searchQuery && (
                                <div className="col-span-full text-xs text-gray-600 mb-2">
                                  找到 {filteredModels.length} 个模型
                                </div>
                              )}
                              {filteredModels.map((model) => (
                            <motion.button
                              key={model.id}
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  model: model.id,
                                }))
                              }
                              className={cn(
                                "p-3 rounded-lg border text-left transition-all",
                                formData.model === model.id
                                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                  : "border-gray-300 hover:border-gray-400"
                              )}
                            >
                              <div className="font-medium text-sm">
                                {highlightSearchTerm(getModelLabel(model.id), searchQuery)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {highlightSearchTerm(getModelDescription(model.id), searchQuery)}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                by {highlightSearchTerm(model.owned_by, searchQuery)}
                              </div>
                            </motion.button>
                              ))}
                            </>
                          ) : searchQuery ? (
                            <div className="col-span-full text-center py-8 text-gray-500">
                              <div className="text-4xl mb-2">🔍</div>
                              <div className="text-sm">未找到匹配的模型</div>
                              <div className="text-xs text-gray-400 mt-1">
                                尝试搜索 &quot;gpt&quot;, &quot;claude&quot;, &quot;openai&quot; 等关键词
                              </div>
                            </div>
                          ) : (
                            <div className="col-span-full text-center py-8 text-gray-500">
                              <div className="text-4xl mb-2">🔍</div>
                              <div className="text-sm">暂无可用模型</div>
                              <div className="text-xs text-gray-400 mt-1">请检查API Key是否正确</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 温度设置 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          创造性 ({formData.temperature})
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={formData.temperature}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              temperature: parseFloat(e.target.value),
                            }))
                          }
                          className="w-full h-2 bg-muted/30 rounded-lg appearance-none cursor-pointer slider"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>保守</span>
                          <span>平衡</span>
                          <span>创造</span>
                        </div>
                      </div>

                      {/* 最大Token数 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          最大回复长度
                        </label>
                        <input
                          type="number"
                          value={formData.maxTokens}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              maxTokens: parseInt(e.target.value),
                            }))
                          }
                          min="100"
                          max="4000"
                          step="100"
                          className="w-full p-3 rounded-lg modern-input bg-white border border-gray-300 focus:border-indigo-500 focus:outline-none transition-colors text-gray-800 placeholder:text-gray-400"
                        />
                        <p className="text-xs text-muted-foreground">
                          建议值：1000-2000，过高可能影响响应速度
                        </p>
                      </div>
                    </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="shortcuts"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                      >
                        {/* 快捷键配置 */}
                        <div className="space-y-6">
                          {/* 全局快捷键开关 */}
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                                <Keyboard size={18} className="text-white" />
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-800">启用快捷键</h3>
                                <p className="text-sm text-gray-500">全局启用或禁用键盘快捷键</p>
                              </div>
                            </div>
                            <motion.button
                              onClick={toggleShortcutsEnabled}
                              className="flex items-center"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              {formData.shortcuts?.enabled ? (
                                <ToggleRight size={32} className="text-indigo-500" />
                              ) : (
                                <ToggleLeft size={32} className="text-gray-400" />
                              )}
                            </motion.button>
                          </div>

                          {/* 快捷键列表 */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="font-medium text-gray-800">快捷键设置</h3>
                              <motion.button
                                onClick={resetShortcuts}
                                className="text-sm text-gray-500 hover:text-gray-700 underline"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                重置为默认
                              </motion.button>
                            </div>

                            <div className="space-y-2">
                              {formData.shortcuts?.shortcuts.map((shortcut, index) => (
                                <motion.div
                                  key={shortcut.id}
                                  className={cn(
                                    "flex items-center justify-between p-3 rounded-lg border transition-all",
                                    shortcut.enabled && formData.shortcuts?.enabled
                                      ? "bg-white border-gray-200 hover:border-gray-300"
                                      : "bg-gray-50 border-gray-200 opacity-60"
                                  )}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  whileHover={{ scale: 1.01 }}
                                >
                                  <div className="flex-1">
                                    <h4 className="font-medium text-sm text-gray-800">{shortcut.name}</h4>
                                    <p className="text-xs text-gray-500 mt-1">{shortcut.description}</p>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    {/* 快捷键显示/编辑 */}
                                    <motion.div
                                      className={cn(
                                        "px-3 py-1.5 rounded-md border text-sm font-mono min-w-[80px] text-center cursor-pointer transition-all",
                                        isRecordingKey && editingShortcut === shortcut.id
                                          ? "bg-yellow-100 border-yellow-400 text-yellow-800 animate-pulse"
                                          : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
                                      )}
                                      onClick={() => startRecordingKey(shortcut.id)}
                                      onKeyDown={(e) => handleKeyRecord(e, shortcut.id)}
                                      tabIndex={0}
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                    >
                                      {isRecordingKey && editingShortcut === shortcut.id
                                        ? "按下快捷键..."
                                        : getShortcutDisplay(shortcut.keys)
                                      }
                                    </motion.div>

                                    {/* 录制控制按钮 */}
                                    {isRecordingKey && editingShortcut === shortcut.id && (
                                      <motion.button
                                        onClick={cancelRecording}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                      >
                                        <X size={14} />
                                      </motion.button>
                                    )}

                                    {/* 启用/禁用开关 */}
                                    <motion.button
                                      onClick={() => toggleShortcut(shortcut.id)}
                                      disabled={!formData.shortcuts?.enabled}
                                      className="flex items-center"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                    >
                                      {shortcut.enabled ? (
                                        <ToggleRight size={20} className="text-indigo-500" />
                                      ) : (
                                        <ToggleLeft size={20} className="text-gray-400" />
                                      )}
                                    </motion.button>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>

                          {/* 快捷键帮助说明 */}
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h4 className="font-medium text-blue-800 mb-2">💡 使用说明</h4>
                            <div className="text-sm text-blue-700 space-y-1">
                              <p>• 点击快捷键按钮来录制新的快捷键组合</p>
                              <p>• 支持 Ctrl、Cmd、Shift、Alt 等修饰键组合</p>
                              <p>• 在输入框中时，部分快捷键会被禁用以避免冲突</p>
                              <p>• 可以单独启用或禁用每个快捷键</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 底部按钮 */}
                <div className="flex-shrink-0 p-6 border-t border-gray-200 bg-gray-50">
                  <div className="flex gap-3 justify-end">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onClose}
                      className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all duration-200 modern-button"
                    >
                      取消
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed modern-button"
                    >
                      {isSaving ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        >
                          <Zap size={16} />
                        </motion.div>
                      ) : (
                        <Save size={16} />
                      )}
                      {isSaving ? "正在保存..." : "保存设置"}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
