/**
 * 章节缓存类型定义
 */

/**
 * 缓存元数据
 */
export interface CacheMeta {
  /** 已缓存的章节 URL 列表 */
  urls: string[];
  /** 总缓存大小（字节） */
  totalSize: number;
  /** 最后清理时间 */
  lastCleanup: number;
}

/**
 * 单个章节缓存
 */
export interface ChapterCache {
  /** 章节内容 */
  content: string;
  /** 缓存时间 */
  cachedAt: number;
  /** 内容大小（字节） */
  size: number;
}
