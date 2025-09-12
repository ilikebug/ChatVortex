import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatTime(date: Date): string {
    return new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

export function generateId(): string {
    return Math.random().toString(36).substring(2, 15)
}

// 检测localStorage的实际存储限制
function detectLocalStorageLimit(): number {
  if (typeof window === 'undefined') return 5 * 1024 * 1024; // 默认5MB

  // 先检查是否已经缓存了限制值
  const cachedLimit = sessionStorage.getItem('localStorage-limit');
  if (cachedLimit) {
    return parseInt(cachedLimit, 10);
  }

  // 不同浏览器的典型限制
  const userAgent = navigator.userAgent.toLowerCase();
  let estimatedLimit: number;

  if (userAgent.includes('chrome') || userAgent.includes('chromium')) {
    estimatedLimit = 10 * 1024 * 1024; // Chrome: ~10MB
  } else if (userAgent.includes('firefox')) {
    estimatedLimit = 10 * 1024 * 1024; // Firefox: ~10MB
  } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    estimatedLimit = 5 * 1024 * 1024; // Safari: ~5MB
  } else if (userAgent.includes('edge')) {
    estimatedLimit = 10 * 1024 * 1024; // Edge: ~10MB
  } else {
    estimatedLimit = 5 * 1024 * 1024; // 其他浏览器默认5MB
  }

  // 缓存到sessionStorage
  try {
    sessionStorage.setItem('localStorage-limit', estimatedLimit.toString());
  } catch (e) {
    // sessionStorage不可用时忽略缓存
  }

  return estimatedLimit;
}

// 实际测试localStorage的真实限制（可选，比较耗时）
export function testLocalStorageLimit(): number {
  if (typeof window === 'undefined') return 5 * 1024 * 1024;

  const testKey = '__test_storage_limit__';
  let size = 0;
  const step = 250 * 1024; // 每次增加250KB
  
  try {
    // 清除测试键
    localStorage.removeItem(testKey);
    
    // 逐步增加数据直到达到限制
    while (size < 15 * 1024 * 1024) { // 最多测试15MB
      const testData = 'A'.repeat(step);
      localStorage.setItem(testKey, testData);
      size += step;
    }
    
    localStorage.removeItem(testKey);
    return size;
    
  } catch (error) {
    localStorage.removeItem(testKey);
    return size;
  }
}

// 检查localStorage使用情况
export function getLocalStorageUsage(): {
  used: number;
  available: number;
  percentage: number;
  itemSizes: Record<string, number>;
  browser: string;
} {
  if (typeof window === 'undefined') {
    return { used: 0, available: 0, percentage: 0, itemSizes: {}, browser: 'unknown' };
  }

  let used = 0;
  const itemSizes: Record<string, number> = {};
  
  // 计算每个项目的大小
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      const value = localStorage.getItem(key) || '';
      const size = (key.length + value.length) * 2; // UTF-16编码，每个字符2字节
      itemSizes[key] = size;
      used += size;
    }
  }

  const available = detectLocalStorageLimit();
  const percentage = (used / available) * 100;

  // 检测浏览器类型
  const userAgent = navigator.userAgent.toLowerCase();
  let browser = 'unknown';
  if (userAgent.includes('chrome') && !userAgent.includes('edge')) browser = 'Chrome';
  else if (userAgent.includes('firefox')) browser = 'Firefox';
  else if (userAgent.includes('safari') && !userAgent.includes('chrome')) browser = 'Safari';
  else if (userAgent.includes('edge')) browser = 'Edge';

  return {
    used,
    available,
    percentage,
    itemSizes,
    browser
  };
}

// 格式化字节大小
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 清理localStorage中的大项目
export function cleanupLargeLocalStorageItems(): void {
  const usage = getLocalStorageUsage();
  
  if (usage.percentage > 80) {
    console.warn('⚠️ localStorage使用率超过80%，开始清理...');
    
    // 按大小排序，找到最大的项目
    const sortedItems = Object.entries(usage.itemSizes)
      .sort(([,a], [,b]) => b - a);
    
    // 如果会话数据占用过多空间，可以考虑压缩或删除老的会话
    const sessionsSize = usage.itemSizes['chatvortex-sessions'] || 0;
    if (sessionsSize > 2 * 1024 * 1024) { // 大于2MB
      console.warn('会话数据过大，建议清理老会话');
    }
  }
}
