"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SessionConfig } from "@/types/chat";
import { fetchAvailableModels, ModelInfo } from "@/lib/api";

interface SessionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SessionConfig;
  onSave: (config: SessionConfig) => void;
  apiKey: string;
  baseUrl: string;
}

// 模型描述映射
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

const ROLE_TEMPLATES = [
  { name: "默认助手", prompt: "" },
  { name: "编程专家", prompt: "你是一位经验丰富的程序员，擅长多种编程语言和技术栈。请用简洁明了的方式回答编程相关问题，并提供实用的代码示例。" },
  { name: "写作助手", prompt: "你是一位专业的写作助手，擅长各种文体的创作和编辑。请帮助用户改进文字表达，提供创意建议，并保持文章的连贯性和可读性。" },
  { name: "学术研究", prompt: "你是一位学术研究专家，具备严谨的研究方法和广博的知识。请用客观、准确的方式回答问题，并提供可靠的信息来源。" },
  { name: "创意伙伴", prompt: "你是一位富有创造力的伙伴，善于跳出常规思维。请用开放、创新的方式思考问题，提供独特的见解和灵感。" },
  { name: "商业顾问", prompt: "你是一位经验丰富的商业顾问，了解市场动态和商业策略。请提供实用的商业建议，并考虑成本效益和可行性。" },
];

export function SessionConfigModal({ isOpen, onClose, config, onSave, apiKey, baseUrl }: SessionConfigModalProps) {
  const [formConfig, setFormConfig] = useState<SessionConfig>(config);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setFormConfig(config);
  }, [config]);

  // 获取模型列表
  useEffect(() => {
    if (isOpen && apiKey && baseUrl) {
      setIsLoadingModels(true);
      setModelError(null);
      
      fetchAvailableModels(apiKey, baseUrl)
        .then(models => {
          setAvailableModels(models);
        })
        .catch(error => {
          console.error('❌ 获取模型列表失败:', error);
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
        });
    }
  }, [isOpen, apiKey, baseUrl]);

  const handleSave = () => {
    onSave(formConfig);
    onClose();
  };

  const handleRoleSelect = (prompt: string) => {
    setFormConfig({ ...formConfig, systemPrompt: prompt });
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">会话配置</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* 模型选择 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">
                AI 模型
              </label>
              {isLoadingModels && (
                <div className="text-xs text-blue-600 flex items-center gap-1">
                  <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  加载中...
                </div>
              )}
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
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
            
            <div className="grid gap-2 max-h-60 overflow-y-auto">
              {filteredModels.length > 0 ? (
                <>
                  {searchQuery && (
                    <div className="text-xs text-gray-600 mb-2">
                      找到 {filteredModels.length} 个模型
                    </div>
                  )}
                  {filteredModels.map((model) => (
                <div
                  key={model.id}
                  onClick={() => setFormConfig({ ...formConfig, model: model.id })}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formConfig.model === model.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">
                        {highlightSearchTerm(getModelLabel(model.id), searchQuery)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {highlightSearchTerm(getModelDescription(model.id), searchQuery)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        by {highlightSearchTerm(model.owned_by, searchQuery)}
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      formConfig.model === model.id
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    }`}>
                      {formConfig.model === model.id && (
                        <div className="w-full h-full rounded-full bg-white scale-50"></div>
                      )}
                    </div>
                  </div>
                </div>
                  ))}
                </>
              ) : searchQuery ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🔍</div>
                  <div className="text-sm">未找到匹配的模型</div>
                  <div className="text-xs text-gray-400 mt-1">
                    尝试搜索 &quot;gpt&quot;, &quot;claude&quot;, &quot;openai&quot; 等关键词
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🔍</div>
                  <div className="text-sm">暂无可用模型</div>
                </div>
              )}
            </div>
          </div>

          {/* 角色设定 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              角色设定
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {ROLE_TEMPLATES.map((role) => (
                <button
                  key={role.name}
                  onClick={() => handleRoleSelect(role.prompt)}
                  className={`p-2 rounded-lg text-sm border transition-all ${
                    formConfig.systemPrompt === role.prompt
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-600"
                  }`}
                >
                  {role.name}
                </button>
              ))}
            </div>
            <textarea
              value={formConfig.systemPrompt || ""}
              onChange={(e) => setFormConfig({ ...formConfig, systemPrompt: e.target.value })}
              placeholder="输入自定义角色设定或系统提示..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={4}
            />
          </div>

          {/* 参数设置 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                温度 (创造性): {formConfig.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={formConfig.temperature}
                onChange={(e) => setFormConfig({ ...formConfig, temperature: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>保守</span>
                <span>创新</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                最大回复长度: {formConfig.maxTokens}
              </label>
              <input
                type="range"
                min="100"
                max="4000"
                step="100"
                value={formConfig.maxTokens}
                onChange={(e) => setFormConfig({ ...formConfig, maxTokens: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>简短</span>
                <span>详细</span>
              </div>
            </div>
          </div>

          {/* 上下文设置 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              上下文记忆限制: {formConfig.contextLimit} tokens
            </label>
            <input
              type="range"
              min="1000"
              max="20000"
              step="1000"
              value={formConfig.contextLimit}
              onChange={(e) => setFormConfig({ ...formConfig, contextLimit: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1K (短期)</span>
              <span>20K (长期)</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              更高的限制可以记住更多对话历史，但会增加 API 消耗
            </p>
          </div>
        </div>

        {/* 按钮组 */}
        <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg"
          >
            保存配置
          </button>
        </div>
      </motion.div>
    </div>
  );
}