/**
 * 图片生成API服务
 */

import {
    ImageGenerationRequest,
    ImageGenerationResponse,
    ImageVariationRequest,
    ImageUpscaleRequest,
    ImageRedrawRequest,
    ImageGenerationTask,
    ImageTaskStatus,
    ImageResult,
    ImageTaskType
} from '@/types/image';

export class ImageGenerationAPI {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey: string, baseUrl: string = 'https://api.gpt.ge') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    /**
     * 文生图
     */
    async generateTextToImage(params: ImageGenerationRequest): Promise<ImageGenerationResponse> {
        // 使用V-API的MidJourney图片生成接口
        const requestBody = {
            botType: "MID_JOURNEY",
            prompt: params.prompt
        };

        try {
            console.log('提交图片生成任务:', requestBody);

            // 第一步：提交生成任务
            const submitResponse = await this.makeRequest('/mj/submit/imagine', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });

            console.log('任务提交响应:', submitResponse);

            // 检查是否成功提交任务
            if (submitResponse && (submitResponse as any).result) {
                const taskId = (submitResponse as any).result;
                console.log('任务ID:', taskId);

                return {
                    task_id: taskId,
                    status: 'pending'
                };
            } else {
                return {
                    task_id: `error_${Date.now()}`,
                    status: 'failed',
                    error: `任务提交失败: ${JSON.stringify(submitResponse)}`
                };
            }

        } catch (error) {
            console.error('V-API图片生成调用失败:', error);
            return {
                task_id: `error_${Date.now()}`,
                status: 'failed',
                error: `API调用失败: ${error instanceof Error ? error.message : '未知错误'}`
            };
        }
    }

    /**
     * 图生图
     */
    async generateImageToImage(params: ImageVariationRequest): Promise<ImageGenerationResponse> {
        const response = await this.makeRequest('/images/variations', {
            method: 'POST',
            body: JSON.stringify({
                model: 'midjourney',
                image: params.image_url,
                prompt: params.prompt,
                negative_prompt: params.negative_prompt,
                width: params.width || 1024,
                height: params.height || 1024,
                steps: params.steps || 20,
                cfg_scale: params.cfg_scale || 7,
                seed: params.seed,
                n: 1
            })
        });

        return response;
    }

    /**
     * 图片变体
     */
    async generateImageVariation(params: ImageVariationRequest): Promise<ImageGenerationResponse> {
        const response = await this.makeRequest('/images/variations', {
            method: 'POST',
            body: JSON.stringify({
                model: 'midjourney',
                image: params.image_url,
                prompt: params.prompt,
                negative_prompt: params.negative_prompt,
                width: params.width || 1024,
                height: params.height || 1024,
                steps: params.steps || 20,
                cfg_scale: params.cfg_scale || 7,
                seed: params.seed,
                n: 1
            })
        });

        return response;
    }

    /**
     * 图片放大
     */
    async upscaleImage(params: ImageUpscaleRequest): Promise<ImageGenerationResponse> {
        const response = await this.makeRequest('/images/upscale', {
            method: 'POST',
            body: JSON.stringify({
                model: 'midjourney',
                image: params.image_url,
                scale: params.scale || 2,
                n: 1
            })
        });

        return response;
    }

    /**
     * 图片重绘
     */
    async redrawImage(params: ImageRedrawRequest): Promise<ImageGenerationResponse> {
        const response = await this.makeRequest('/images/redraw', {
            method: 'POST',
            body: JSON.stringify({
                model: 'midjourney',
                image: params.image_url,
                prompt: params.prompt,
                negative_prompt: params.negative_prompt,
                strength: params.strength || 0.8,
                steps: params.steps || 20,
                cfg_scale: params.cfg_scale || 7,
                seed: params.seed,
                n: 1
            })
        });

        return response;
    }

    /**
     * 查询任务状态
     */
    async getTaskStatus(taskId: string): Promise<ImageGenerationResponse> {
        // 如果是错误任务ID，直接返回失败状态
        if (taskId.startsWith('error_')) {
            return {
                task_id: taskId,
                status: 'failed',
                error: '图片生成失败'
            };
        }

        try {
            console.log('查询任务状态:', taskId);

            // 调用V-API的任务状态查询接口
            const response = await this.makeRequest('/mj/task/list-by-condition', {
                method: 'POST',
                body: JSON.stringify({
                    ids: [taskId]
                })
            });

            console.log('任务状态响应:', response);

            // 解析响应
            if (Array.isArray(response) && response.length > 0) {
                const task = response[0];
                const taskStatus = task.status;

                // 映射V-API状态到内部状态
                let internalStatus: 'pending' | 'processing' | 'completed' | 'failed';
                switch (taskStatus) {
                    case 'SUCCESS':
                        internalStatus = 'completed';
                        break;
                    case 'FAILURE':
                    case 'FAILED':
                        internalStatus = 'failed';
                        break;
                    case 'IN_PROGRESS':
                    case 'PROCESSING':
                        internalStatus = 'processing';
                        break;
                    default:
                        internalStatus = 'pending';
                }

                // 如果任务完成，返回图片信息
                if (internalStatus === 'completed' && task.imageUrl) {
                    return {
                        task_id: taskId,
                        status: 'completed',
                        result: {
                            images: [{
                                id: taskId,
                                url: task.imageUrl,
                                width: 1024, // V-API默认尺寸
                                height: 1024
                            }]
                        }
                    };
                } else if (internalStatus === 'failed') {
                    return {
                        task_id: taskId,
                        status: 'failed',
                        error: task.failReason || '图片生成失败'
                    };
                } else {
                    return {
                        task_id: taskId,
                        status: internalStatus,
                        progress: task.progress || '0%'
                    };
                }
            } else {
                return {
                    task_id: taskId,
                    status: 'pending'
                };
            }

        } catch (error) {
            console.error('查询任务状态失败:', error);
            return {
                task_id: taskId,
                status: 'failed',
                error: error instanceof Error ? error.message : '查询任务状态失败'
            };
        }
    }

    /**
     * 轮询任务状态直到完成
     */
    async pollTaskStatus(
        taskId: string,
        onStatusUpdate?: (status: ImageTaskStatus) => void,
        maxAttempts: number = 300, // 增加到300次，总共10分钟
        interval: number = 2000
    ): Promise<ImageGenerationResponse> {
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const response = await this.getTaskStatus(taskId);

                if (onStatusUpdate) {
                    onStatusUpdate(response.status);
                }

                if (response.status === 'completed' || response.status === 'failed') {
                    return response;
                }

                // 等待指定时间后重试
                await new Promise(resolve => setTimeout(resolve, interval));
                attempts++;
            } catch (error) {
                console.error('轮询任务状态失败:', error);
                attempts++;
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }

        throw new Error('任务状态轮询超时');
    }

    /**
     * 下载图片
     */
    async downloadImage(imageUrl: string): Promise<Blob> {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error('下载图片失败');
        }
        return response.blob();
    }

    /**
     * 保存图片到本地
     */
    async saveImageToLocal(imageUrl: string, filename: string): Promise<void> {
        try {
            const blob = await this.downloadImage(imageUrl);
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('保存图片失败:', error);
            throw error;
        }
    }

    /**
     * 通用请求方法
     */
    private async makeRequest(endpoint: string, options: RequestInit): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.error?.message ||
                `图片生成请求失败: ${response.status} ${response.statusText}`
            );
        }

        return response.json();
    }
}

// 创建默认实例
export const createImageAPI = (apiKey: string, baseUrl?: string) => {
    return new ImageGenerationAPI(apiKey, baseUrl);
};

// 图片生成工具函数
export const imageUtils = {
    /**
     * 生成随机种子
     */
    generateSeed: (): number => {
        return Math.floor(Math.random() * 1000000);
    },

    /**
     * 格式化文件大小
     */
    formatFileSize: (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * 获取图片尺寸标签
     */
    getImageSizeLabel: (width: number, height: number): string => {
        const commonSizes = [
            { w: 512, h: 512, label: '1:1 (正方形)' },
            { w: 768, h: 512, label: '3:2 (横屏)' },
            { w: 512, h: 768, label: '2:3 (竖屏)' },
            { w: 1024, h: 1024, label: '1:1 (高清)' },
            { w: 1024, h: 768, label: '4:3 (横屏)' },
            { w: 768, h: 1024, label: '3:4 (竖屏)' },
            { w: 1920, h: 1080, label: '16:9 (宽屏)' },
            { w: 1080, h: 1920, label: '9:16 (手机)' }
        ];

        const matched = commonSizes.find(size => size.w === width && size.h === height);
        return matched ? matched.label : `${width}×${height}`;
    },

    /**
     * 验证图片URL
     */
    isValidImageUrl: (url: string): boolean => {
        try {
            new URL(url);
            return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
        } catch {
            return false;
        }
    }
};
