/**
 * 图片处理工具函数
 */

/**
 * 将File对象转换为base64字符串
 */
export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * 将File对象转换为V-API格式的图片数据
 */
export async function fileToImageData(file: File): Promise<{
    type: 'image_url';
    image_url: {
        url: string;
        detail?: 'low' | 'high' | 'auto';
    };
}> {
    const base64 = await fileToBase64(file);
    return {
        type: 'image_url',
        image_url: {
            url: base64,
            detail: 'auto' // 自动选择图片质量
        }
    };
}

/**
 * 检查文件是否为支持的图片格式
 */
export function isSupportedImageType(file: File): boolean {
    const supportedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
    ];
    return supportedTypes.includes(file.type);
}

/**
 * 检查文件大小是否在限制范围内
 */
export function isFileSizeValid(file: File, maxSizeMB: number = 20): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
}

/**
 * 生成图片的唯一ID
 */
export function generateImageId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 创建ImageData对象
 */
export async function createImageData(file: File): Promise<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
}> {
    const base64 = await fileToBase64(file);
    return {
        id: generateImageId(),
        name: file.name,
        url: base64,
        type: file.type,
        size: file.size
    };
}
