"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Grid3X3,
  List,
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  Heart,
  Share2,
  Copy,
  Calendar,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ImageResult, ImageHistory, ImageTaskStatus } from "@/types/image";
import { createImageAPI, imageUtils } from "@/lib/imageApi";

interface ImageGalleryProps {
  apiKey: string;
  baseUrl?: string;
  onClose?: () => void;
}

type ViewMode = "grid" | "list";
type SortBy = "newest" | "oldest" | "size" | "name";

export function ImageGallery({ apiKey, baseUrl, onClose }: ImageGalleryProps) {
  const [images, setImages] = useState<ImageResult[]>([]);
  const [filteredImages, setFilteredImages] = useState<ImageResult[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<ImageResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pollingTasks, setPollingTasks] = useState<Set<string>>(new Set());

  const imageAPI = createImageAPI(apiKey, baseUrl);

  // 加载图片历史
  useEffect(() => {
    loadImageHistory();
  }, []);

  // 轮询任务状态
  useEffect(() => {
    const pendingTasks = images.filter(
      (img) => img.status === "pending" || img.status === "processing"
    );

    if (pendingTasks.length > 0) {
      const taskIds = pendingTasks
        .map((task) => task.taskId || task.id)
        .filter(Boolean);

      // 开始轮询
      const pollInterval = setInterval(async () => {
        // 每次轮询时重新获取待处理的任务
        const currentPendingTasks = images.filter(
          (img) => img.status === "pending" || img.status === "processing"
        );

        if (currentPendingTasks.length === 0) {
          // 没有待处理的任务，清除轮询
          clearInterval(pollInterval);
          return;
        }

        const currentTaskIds = currentPendingTasks
          .map((task) => task.taskId || task.id)
          .filter(Boolean);

        for (const taskId of currentTaskIds) {
          try {
            const response = await imageAPI.getTaskStatus(taskId);

            if (response.status === "completed" && response.result?.images) {
              // 更新图片URL
              setImages((prev) => {
                const updated = prev.map((img) => {
                  if (img.taskId === taskId || img.id === taskId) {
                    return {
                      ...img,
                      url: response.result!.images[0].url,
                      status: "completed" as ImageTaskStatus,
                    };
                  }
                  return img;
                });

                // 保存到localStorage
                localStorage.setItem(
                  "chatvortex-image-history",
                  JSON.stringify(updated)
                );
                return updated;
              });
            } else if (response.status === "failed") {
              // 更新失败状态
              setImages((prev) => {
                const updated = prev.map((img) => {
                  if (img.taskId === taskId || img.id === taskId) {
                    return {
                      ...img,
                      status: "failed" as ImageTaskStatus,
                    };
                  }
                  return img;
                });

                // 保存到localStorage
                localStorage.setItem(
                  "chatvortex-image-history",
                  JSON.stringify(updated)
                );
                return updated;
              });
            } else {
              // 更新进度状态
              setImages((prev) => {
                const updated = prev.map((img) => {
                  if (img.taskId === taskId || img.id === taskId) {
                    return {
                      ...img,
                      status: response.status as ImageTaskStatus,
                      progress: response.progress,
                    };
                  }
                  return img;
                });

                // 保存到localStorage
                localStorage.setItem(
                  "chatvortex-image-history",
                  JSON.stringify(updated)
                );
                return updated;
              });
            }
          } catch (error) {
            console.error(`轮询任务 ${taskId} 失败:`, error);
          }
        }
      }, 3000); // 每3秒轮询一次

      return () => clearInterval(pollInterval);
    }
  }, [images, imageAPI]);

  // 过滤和排序图片
  useEffect(() => {
    let filtered = [...images];

    // 搜索过滤
    if (searchQuery) {
      filtered = filtered.filter(
        (image) =>
          image.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          image.metadata?.model
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase())
      );
    }

    // 排序
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.id).getTime() - new Date(a.id).getTime();
        case "oldest":
          return new Date(a.id).getTime() - new Date(b.id).getTime();
        case "size":
          return b.width * b.height - a.width * a.height;
        case "name":
          return a.id.localeCompare(b.id);
        default:
          return 0;
      }
    });

    setFilteredImages(filtered);
  }, [images, searchQuery, sortBy]);

  // 加载图片历史
  const loadImageHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      // 从localStorage加载图片历史
      const savedImages = localStorage.getItem("chatvortex-image-history");
      if (savedImages) {
        const parsedImages = JSON.parse(savedImages);
        setImages(parsedImages);

        // 检查失败的任务并重新尝试
        const failedTasks = parsedImages.filter(
          (img: ImageResult) => img.status === "failed" && img.taskId
        );

        if (failedTasks.length > 0) {
          console.log(`发现 ${failedTasks.length} 个失败的任务，重新尝试...`);

          // 将失败的任务状态重置为pending，让轮询逻辑重新处理
          const updatedImages = parsedImages.map((img: ImageResult) => {
            if (img.status === "failed" && img.taskId) {
              return {
                ...img,
                status: "pending" as ImageTaskStatus,
                progress: undefined,
              };
            }
            return img;
          });

          setImages(updatedImages);
          localStorage.setItem(
            "chatvortex-image-history",
            JSON.stringify(updatedImages)
          );
        }
      }
    } catch (error) {
      console.error("加载图片历史失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 保存图片历史
  const saveImageHistory = useCallback((newImages: ImageResult[]) => {
    try {
      localStorage.setItem(
        "chatvortex-image-history",
        JSON.stringify(newImages)
      );
    } catch (error) {
      console.error("保存图片历史失败:", error);
    }
  }, []);

  // 添加新图片
  const addImage = useCallback(
    (image: ImageResult) => {
      setImages((prev) => {
        const newImages = [image, ...prev];
        saveImageHistory(newImages);
        return newImages;
      });
    },
    [saveImageHistory]
  );

  // 删除图片
  const deleteImage = useCallback(
    (imageId: string) => {
      setImages((prev) => {
        const newImages = prev.filter((img) => img.id !== imageId);
        saveImageHistory(newImages);
        return newImages;
      });
      setSelectedImages((prev) => {
        const newSelected = new Set(prev);
        newSelected.delete(imageId);
        return newSelected;
      });
    },
    [saveImageHistory]
  );

  // 批量删除
  const deleteSelectedImages = useCallback(() => {
    if (selectedImages.size === 0) return;

    if (confirm(`确定要删除选中的 ${selectedImages.size} 张图片吗？`)) {
      setImages((prev) => {
        const newImages = prev.filter((img) => !selectedImages.has(img.id));
        saveImageHistory(newImages);
        return newImages;
      });
      setSelectedImages(new Set());
    }
  }, [selectedImages, saveImageHistory]);

  // 下载图片
  const downloadImage = useCallback(
    async (image: ImageResult) => {
      try {
        const filename = `generated_image_${image.id}.png`;
        await imageAPI.saveImageToLocal(image.url, filename);
      } catch (error) {
        console.error("下载失败:", error);
        alert("下载失败，请重试");
      }
    },
    [imageAPI]
  );

  // 批量下载
  const downloadSelectedImages = useCallback(async () => {
    if (selectedImages.size === 0) return;

    for (const imageId of Array.from(selectedImages)) {
      const image = images.find((img) => img.id === imageId);
      if (image) {
        try {
          await downloadImage(image);
          // 添加延迟避免浏览器阻止多个下载
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`下载图片 ${imageId} 失败:`, error);
        }
      }
    }
  }, [selectedImages, images, downloadImage]);

  // 复制图片链接
  const copyImageLink = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("链接已复制到剪贴板");
    } catch (error) {
      console.error("复制失败:", error);
    }
  }, []);

  // 切换图片选择
  const toggleImageSelection = useCallback((imageId: string) => {
    setSelectedImages((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(imageId)) {
        newSelected.delete(imageId);
      } else {
        newSelected.add(imageId);
      }
      return newSelected;
    });
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedImages.size === filteredImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(filteredImages.map((img) => img.id)));
    }
  }, [selectedImages.size, filteredImages]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载图片历史中...</p>
        </div>
      </div>
    );
  }

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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">图片画廊</h2>
              <p className="text-sm text-gray-500">
                {filteredImages.length} 张图片
                {selectedImages.size > 0 &&
                  ` (已选择 ${selectedImages.size} 张)`}
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

        {/* 工具栏 */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-4">
            {/* 左侧控制 */}
            <div className="flex items-center gap-4">
              {/* 搜索 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索图片..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
                />
              </div>

              {/* 排序 */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="newest">最新</option>
                <option value="oldest">最旧</option>
                <option value="size">尺寸</option>
                <option value="name">名称</option>
              </select>
            </div>

            {/* 右侧控制 */}
            <div className="flex items-center gap-2">
              {/* 视图模式 */}
              <div className="flex bg-gray-200 rounded-lg p-1">
                <motion.button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === "grid"
                      ? "bg-white text-purple-600"
                      : "text-gray-600"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Grid3X3 className="w-4 h-4" />
                </motion.button>
                <motion.button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === "list"
                      ? "bg-white text-purple-600"
                      : "text-gray-600"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <List className="w-4 h-4" />
                </motion.button>
              </div>

              {/* 批量操作 */}
              {selectedImages.size > 0 && (
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={downloadSelectedImages}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Download className="w-4 h-4" />
                    下载选中
                  </motion.button>
                  <motion.button
                    onClick={deleteSelectedImages}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Trash2 className="w-4 h-4" />
                    删除选中
                  </motion.button>
                </div>
              )}

              {/* 全选 */}
              <motion.button
                onClick={toggleSelectAll}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {selectedImages.size === filteredImages.length
                  ? "取消全选"
                  : "全选"}
              </motion.button>
            </div>
          </div>
        </div>

        {/* 图片内容 */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredImages.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? "没有找到匹配的图片" : "还没有生成任何图片"}
              </h3>
              <p className="text-gray-500">
                {searchQuery
                  ? "尝试使用不同的关键词搜索"
                  : "开始生成您的第一张图片"}
              </p>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                  : "space-y-4"
              }
            >
              {filteredImages.map((image, index) => (
                <motion.div
                  key={image.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative group bg-gray-50 rounded-lg overflow-hidden ${
                    viewMode === "list" ? "flex" : ""
                  } ${selectedImages.has(image.id) ? "ring-2 ring-purple-500" : ""}`}
                >
                  {/* 选择框 */}
                  <div className="absolute top-2 left-2 z-10">
                    <motion.button
                      onClick={() => toggleImageSelection(image.id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedImages.has(image.id)
                          ? "bg-purple-500 border-purple-500 text-white"
                          : "bg-white border-gray-300 hover:border-purple-500"
                      }`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {selectedImages.has(image.id) && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2 h-2 bg-white rounded-full"
                        />
                      )}
                    </motion.button>
                  </div>

                  {/* 图片 */}
                  <div
                    className={`${viewMode === "list" ? "w-32 h-32 flex-shrink-0" : "aspect-square"} relative`}
                  >
                    {image.url ? (
                      <img
                        src={image.url}
                        alt={`Generated image ${index + 1}`}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setPreviewImage(image)}
                      />
                    ) : (
                      // 显示生成状态
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          <div className="text-xs text-gray-600">
                            {image.status === "pending" && "等待开始..."}
                            {image.status === "processing" &&
                              (image.progress
                                ? `正在生成... ${image.progress}`
                                : "正在生成...")}
                            {image.status === "failed" && "生成失败"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 图片信息 */}
                  <div className={`p-3 ${viewMode === "list" ? "flex-1" : ""}`}>
                    {image.prompt && (
                      <div className="text-sm text-gray-700 mb-2 line-clamp-2">
                        {image.prompt}
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {imageUtils.getImageSizeLabel(
                          image.width,
                          image.height
                        )}
                      </span>
                      <span className="text-xs text-gray-500">
                        种子: {image.metadata?.seed}
                      </span>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      {image.url ? (
                        <>
                          <motion.button
                            onClick={() => setPreviewImage(image)}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Eye className="w-3 h-3" />
                            预览
                          </motion.button>
                          <motion.button
                            onClick={() => downloadImage(image)}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Download className="w-3 h-3" />
                            下载
                          </motion.button>
                        </>
                      ) : (
                        <div className="flex-1 px-2 py-1 bg-gray-300 text-gray-600 text-xs rounded text-center">
                          {image.status === "pending" && "等待生成..."}
                          {image.status === "processing" &&
                            (image.progress
                              ? `生成中... ${image.progress}`
                              : "生成中...")}
                          {image.status === "failed" && "生成失败"}
                        </div>
                      )}
                      <motion.button
                        onClick={() => deleteImage(image.id)}
                        className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* 图片预览模态框 */}
        <AnimatePresence>
          {previewImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4"
              onClick={() => setPreviewImage(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 预览头部 */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      图片预览
                    </h3>
                    <span className="text-sm text-gray-500">
                      {imageUtils.getImageSizeLabel(
                        previewImage.width,
                        previewImage.height
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      onClick={() => copyImageLink(previewImage.url)}
                      className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Copy className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      onClick={() => downloadImage(previewImage)}
                      className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Download className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      onClick={() => setPreviewImage(null)}
                      className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>

                {/* 预览内容 */}
                <div className="p-4">
                  <img
                    src={previewImage.url}
                    alt="Preview"
                    className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                  />

                  {/* 图片详情 */}
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">尺寸:</span>
                      <span className="ml-2 text-gray-600">
                        {previewImage.width} × {previewImage.height}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">种子:</span>
                      <span className="ml-2 text-gray-600">
                        {previewImage.metadata?.seed}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">步数:</span>
                      <span className="ml-2 text-gray-600">
                        {previewImage.metadata?.steps}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">CFG:</span>
                      <span className="ml-2 text-gray-600">
                        {previewImage.metadata?.cfg_scale}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
