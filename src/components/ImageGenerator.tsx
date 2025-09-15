"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  RefreshCw,
  X,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  ImageGenerationParams,
  ImageGenerationTask,
  ImageTaskStatus,
  ImageResult,
} from "@/types/image";
import { createImageAPI, imageUtils } from "@/lib/imageApi";

interface ImageGeneratorProps {
  apiKey: string;
  baseUrl?: string;
  onImageGenerated?: (result: ImageResult) => void;
  onClose?: () => void;
}

export function ImageGenerator({
  apiKey,
  baseUrl,
  onImageGenerated,
  onClose,
}: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [params, setParams] = useState<ImageGenerationParams>({
    prompt: "",
    width: 1024,
    height: 1024,
    steps: 20,
    cfg_scale: 7,
    seed: imageUtils.generateSeed(),
    sampler: "DPM++ 2M Karras",
  });

  const [currentTask, setCurrentTask] = useState<ImageGenerationTask | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const imageAPI = createImageAPI(apiKey, baseUrl);

  // 开始生成图片
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      alert("请输入提示词");
      return;
    }

    setIsGenerating(true);

    const task: ImageGenerationTask = {
      id: `task_${Date.now()}`,
      type: "text-to-image",
      status: "pending",
      params: {
        ...params,
        prompt: prompt.trim(),
        negative_prompt: negativePrompt.trim() || undefined,
      },
      createdAt: new Date(),
    };

    setCurrentTask(task);

    try {
      // 调用API生成图片
      const response = await imageAPI.generateTextToImage(task.params);

      if (response.task_id) {
        // 更新任务ID
        task.id = response.task_id;
        setCurrentTask({ ...task, id: response.task_id });

        // 立即完成生成状态，让用户知道任务已提交
        setIsGenerating(false);

        // 立即保存任务到画廊，显示生成流程
        if (onImageGenerated) {
          onImageGenerated({
            id: response.task_id,
            url: "", // 暂时为空，等待生成完成
            width: params.width || 1024,
            height: params.height || 1024,
            size: 0,
            format: "png",
            metadata: {
              seed: params.seed,
              steps: params.steps,
              cfg_scale: params.cfg_scale,
              model: "midjourney",
            },
            status: "pending", // 添加状态字段
            prompt: params.prompt,
            createdAt: new Date(),
            taskId: response.task_id,
          });
        }

        // 任务已提交，画廊会负责轮询状态
        // 显示成功提示
        alert(
          "✅ 图片生成任务已提交成功！\n\n请点击画廊按钮查看生成进度和结果。"
        );

        // 延迟3秒后清除任务状态，让用户看到提交成功状态
        setTimeout(() => {
          setCurrentTask(null);
        }, 3000);
      }
    } catch (error) {
      console.error("图片生成失败:", error);
      setCurrentTask((prev) =>
        prev
          ? {
              ...prev,
              status: "failed",
              error: error instanceof Error ? error.message : "生成失败",
            }
          : null
      );
      setIsGenerating(false);
    }
  }, [prompt, negativePrompt, params, imageAPI, onImageGenerated]);

  // 重新生成
  const handleRegenerate = useCallback(() => {
    setParams((prev) => ({ ...prev, seed: imageUtils.generateSeed() }));
    handleGenerate();
  }, [handleGenerate]);

  // 获取状态图标
  const getStatusIcon = (status: ImageTaskStatus) => {
    switch (status) {
      case "pending":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case "processing":
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI 图片生成器</h2>
              <p className="text-sm text-gray-500">
                使用 MidJourney 生成精美图片
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onClose && (
              <motion.button
                onClick={onClose}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {/* 控制面板 */}
          <div className="w-full p-6 flex-1">
            <div className="space-y-4 h-full flex flex-col">
              {/* 提示词输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  提示词 *
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="描述您想要生成的图片..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {/* 负面提示词 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  负面提示词
                </label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="描述您不想要的内容..."
                  className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {/* 高级设置 */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      宽度
                    </label>
                    <select
                      value={params.width}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          width: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value={512}>512px</option>
                      <option value={768}>768px</option>
                      <option value={1024}>1024px</option>
                      <option value={1536}>1536px</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      高度
                    </label>
                    <select
                      value={params.height}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          height: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value={512}>512px</option>
                      <option value={768}>768px</option>
                      <option value={1024}>1024px</option>
                      <option value={1536}>1536px</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      生成步数
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={params.steps}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          steps: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CFG 缩放
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      step="0.1"
                      value={params.cfg_scale}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          cfg_scale: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    随机种子
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={params.seed}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          seed: Number(e.target.value),
                        }))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <motion.button
                      onClick={() =>
                        setParams((prev) => ({
                          ...prev,
                          seed: imageUtils.generateSeed(),
                        }))
                      }
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* 生成按钮 */}
              <div className="flex gap-3 mt-auto">
                <motion.button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      生成图片
                    </>
                  )}
                </motion.button>
              </div>

              {/* 当前任务状态 */}
              {currentTask && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(currentTask.status)}
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {currentTask.status === "pending" && "等待开始..."}
                        {currentTask.status === "processing" &&
                          "正在生成图片..."}
                        {currentTask.status === "completed" && "生成完成！"}
                        {currentTask.status === "failed" && "生成失败"}
                      </div>
                      {currentTask.error && (
                        <div className="text-sm text-red-600 mt-1">
                          {currentTask.error}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
