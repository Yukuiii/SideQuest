/**
 * 章节缓存管理器
 * 使用 localStorage 存储，实现 LRU 清理策略
 */

import type { CacheMeta, ChapterCache } from "./types";

/** 最大缓存大小：10MB */
const MAX_CACHE_SIZE = 10 * 1024 * 1024;

/** 单章节最大大小：100KB */
const MAX_CHAPTER_SIZE = 100 * 1024;

/** 清理阈值：80% */
const CLEANUP_THRESHOLD = 0.8;

/** 元数据存储键 */
const META_KEY = "cache:meta";

/** 章节缓存键前缀 */
const CACHE_PREFIX = "cache:chapter:";

/**
 * 获取缓存元数据
 */
function getMeta(): CacheMeta {
  try {
    const json = localStorage.getItem(META_KEY);
    if (json) {
      return JSON.parse(json);
    }
  } catch (err) {
    console.error("[CacheManager] Failed to load meta:", err);
  }
  return {
    urls: [],
    totalSize: 0,
    lastCleanup: Date.now(),
  };
}

/**
 * 保存缓存元数据
 */
function saveMeta(meta: CacheMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (err) {
    console.error("[CacheManager] Failed to save meta:", err);
  }
}

/**
 * 生成缓存键
 */
function getCacheKey(url: string): string {
  // 使用 base64 编码 URL，截取前50个字符作为键
  try {
    return CACHE_PREFIX + btoa(url).substring(0, 50);
  } catch {
    // 如果 base64 编码失败（非 ASCII 字符），使用 URL 的 hash
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash) + url.charCodeAt(i);
      hash = hash & hash;
    }
    return CACHE_PREFIX + Math.abs(hash).toString(36);
  }
}

/**
 * 获取缓存的章节内容
 */
export function getCachedContent(url: string): string | null {
  try {
    const key = getCacheKey(url);
    const json = localStorage.getItem(key);
    if (!json) return null;

    const cache: ChapterCache = JSON.parse(json);

    // 更新访问时间（LRU）
    cache.cachedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(cache));

    return cache.content;
  } catch (err) {
    console.error("[CacheManager] Failed to get cached content:", err);
    return null;
  }
}

/**
 * LRU 清理：删除最旧的缓存直到大小低于阈值
 */
function performLRUCleanup(meta: CacheMeta, targetSize: number): CacheMeta {
  console.log(`[CacheManager] Starting LRU cleanup, target: ${targetSize} bytes`);

  // 读取所有缓存的时间戳
  const cacheItems: Array<{ url: string; cachedAt: number; size: number }> = [];

  for (const url of meta.urls) {
    try {
      const key = getCacheKey(url);
      const json = localStorage.getItem(key);
      if (json) {
        const cache: ChapterCache = JSON.parse(json);
        cacheItems.push({ url, cachedAt: cache.cachedAt, size: cache.size });
      }
    } catch (err) {
      console.error("[CacheManager] Failed to read cache item:", err);
    }
  }

  // 按时间排序（最旧的在前）
  cacheItems.sort((a, b) => a.cachedAt - b.cachedAt);

  // 删除最旧的缓存，直到总大小低于目标
  let currentSize = meta.totalSize;
  const remainingUrls: string[] = [];

  for (const item of cacheItems) {
    if (currentSize <= targetSize) {
      // 已经达到目标，保留剩余缓存
      remainingUrls.push(item.url);
    } else {
      // 删除这个缓存
      try {
        const key = getCacheKey(item.url);
        localStorage.removeItem(key);
        currentSize -= item.size;
        console.log(`[CacheManager] Removed cache for ${item.url}, freed ${item.size} bytes`);
      } catch (err) {
        console.error("[CacheManager] Failed to remove cache:", err);
      }
    }
  }

  return {
    urls: remainingUrls,
    totalSize: currentSize,
    lastCleanup: Date.now(),
  };
}

/**
 * 缓存章节内容
 */
export function cacheContent(url: string, content: string): boolean {
  try {
    const contentSize = new Blob([content]).size;

    // 检查单章节大小限制
    if (contentSize > MAX_CHAPTER_SIZE) {
      console.warn(`[CacheManager] Chapter too large: ${contentSize} bytes, skipping cache`);
      return false;
    }

    let meta = getMeta();

    // 检查是否需要清理
    if (meta.totalSize + contentSize > MAX_CACHE_SIZE * CLEANUP_THRESHOLD) {
      const targetSize = MAX_CACHE_SIZE * 0.5; // 清理到 50%
      meta = performLRUCleanup(meta, targetSize);
    }

    // 再次检查容量
    if (meta.totalSize + contentSize > MAX_CACHE_SIZE) {
      console.warn(`[CacheManager] Cache full, cannot add new chapter`);
      return false;
    }

    // 保存缓存
    const cache: ChapterCache = {
      content,
      cachedAt: Date.now(),
      size: contentSize,
    };

    const key = getCacheKey(url);

    try {
      localStorage.setItem(key, JSON.stringify(cache));
    } catch (err) {
      if (err instanceof Error && err.name === "QuotaExceededError") {
        // localStorage 配额超出，清理后重试
        console.warn("[CacheManager] QuotaExceededError, performing cleanup");
        meta = performLRUCleanup(meta, MAX_CACHE_SIZE * 0.3);
        try {
          localStorage.setItem(key, JSON.stringify(cache));
        } catch {
          console.error("[CacheManager] Failed to cache even after cleanup");
          return false;
        }
      } else {
        throw err;
      }
    }

    // 更新元数据
    if (!meta.urls.includes(url)) {
      meta.urls.push(url);
      meta.totalSize += contentSize;
    }
    saveMeta(meta);

    console.log(`[CacheManager] Cached ${url}, size: ${contentSize} bytes, total: ${meta.totalSize} bytes`);
    return true;
  } catch (err) {
    console.error("[CacheManager] Failed to cache content:", err);
    return false;
  }
}

/**
 * 清空所有缓存
 */
export function clearAllCache(): void {
  try {
    const meta = getMeta();

    // 删除所有缓存项
    for (const url of meta.urls) {
      const key = getCacheKey(url);
      localStorage.removeItem(key);
    }

    // 重置元数据
    saveMeta({
      urls: [],
      totalSize: 0,
      lastCleanup: Date.now(),
    });

    console.log("[CacheManager] All cache cleared");
  } catch (err) {
    console.error("[CacheManager] Failed to clear cache:", err);
  }
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): { count: number; size: number; sizeText: string } {
  const meta = getMeta();
  const sizeInMB = (meta.totalSize / 1024 / 1024).toFixed(2);
  return {
    count: meta.urls.length,
    size: meta.totalSize,
    sizeText: `${sizeInMB} MB`,
  };
}
