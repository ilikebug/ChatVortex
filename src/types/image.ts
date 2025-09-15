/**
 * 图片生成相关类型定义
 */

// 图片生成任务状态
export type ImageTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 图片生成任务类型
export type ImageTaskType = 'text-to-image' | 'image-to-image' | 'image-variation' | 'image-upscale' | 'image-redraw';

// 图片生成参数
export interface ImageGenerationParams {
    prompt: string; // 提示词
    negative_prompt?: string; // 负面提示词
    width?: number; // 图片宽度
    height?: number; // 图片高度
    steps?: number; // 生成步数
    cfg_scale?: number; // CFG缩放
    seed?: number; // 随机种子
    sampler?: string; // 采样器
    model?: string; // 模型
}

// 图片生成任务
export interface ImageGenerationTask {
    id: string;
    type: ImageTaskType;
    status: ImageTaskStatus;
    params: ImageGenerationParams;
    result?: ImageResult;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
}

// 图片结果
export interface ImageResult {
    id: string;
    url: string;
    width: number;
    height: number;
    size: number;
    format: string;
    status?: ImageTaskStatus; // 添加状态字段
    progress?: string; // 添加进度字段
    prompt?: string; // 添加提示词字段
    createdAt?: Date; // 添加创建时间
    taskId?: string; // 添加任务ID
    metadata?: {
        seed?: number;
        steps?: number;
        cfg_scale?: number;
        model?: string;
    };
}

// 图片生成历史记录
export interface ImageHistory {
    id: string;
    tasks: ImageGenerationTask[];
    createdAt: Date;
    updatedAt: Date;
}

// 图片生成配置
export interface ImageGenerationConfig {
    defaultModel: string;
    defaultWidth: number;
    defaultHeight: number;
    defaultSteps: number;
    defaultCfgScale: number;
    maxConcurrentTasks: number;
    autoSave: boolean;
}

// 图片生成API响应
export interface ImageGenerationResponse {
    task_id: string;
    status: ImageTaskStatus;
    progress?: string; // 添加进度字段
    result?: {
        images: Array<{
            id: string;
            url: string;
            width: number;
            height: number;
        }>;
    };
    error?: string;
    // 支持聊天API响应格式
    choices?: Array<{
        message: {
            content: string;
        };
    }>;
    // 支持V-API响应格式
    api_status?: 'success' | 'error';
    data?: {
        image_urls: string[];
        gpt_result?: string;
        time_elapsed?: string;
        usage?: {
            total_cost: number;
        };
        api_version?: string;
        api_docs?: string;
    };
}

// 图片生成请求
export interface ImageGenerationRequest {
    prompt: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
    steps?: number;
    cfg_scale?: number;
    seed?: number;
    sampler?: string;
    model?: string;
}

// 图片变体请求
export interface ImageVariationRequest {
    image_url: string;
    prompt?: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
    steps?: number;
    cfg_scale?: number;
    seed?: number;
}

// 图片放大请求
export interface ImageUpscaleRequest {
    image_url: string;
    scale?: number;
    model?: string;
}

// 图片重绘请求
export interface ImageRedrawRequest {
    image_url: string;
    prompt: string;
    negative_prompt?: string;
    strength?: number;
    steps?: number;
    cfg_scale?: number;
    seed?: number;
}
