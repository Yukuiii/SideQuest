/**
 * 书源类型定义
 * 仅支持 ESO 格式
 */

import type { EsoSource } from "./esoTypes";

/** 书源内容类型 */
export const BookSourceType = {
  /** 小说/文字 */
  Novel: 0,
  /** 漫画/图片 */
  Comic: 1,
  /** 有声书/音频 */
  Audio: 2,
} as const;

/** 书源内容类型 */
export type BookSourceType = (typeof BookSourceType)[keyof typeof BookSourceType];

/**
 * 统一的书源格式 (内部使用)
 */
export interface UnifiedSource {
  /** 唯一标识 */
  id: string;
  /** 书源名称 */
  name: string;
  /** 书源地址 */
  url: string;
  /** 书源类型 */
  type: BookSourceType;
  /** 分组 */
  group?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 原始数据 */
  raw: EsoSource;
}

/**
 * 书籍信息
 */
export interface BookInfo {
  /** 书名 */
  name: string;
  /** 作者 */
  author?: string;
  /** 封面 URL */
  coverUrl?: string;
  /** 简介 */
  intro?: string;
  /** 分类/标签 */
  kind?: string;
  /** 字数 */
  wordCount?: string;
  /** 最新章节 */
  lastChapter?: string;
  /** 书籍详情 URL */
  bookUrl: string;
  /** 来源书源 ID */
  sourceId: string;
}

/**
 * 章节信息
 */
export interface ChapterInfo {
  /** 章节名称 */
  name: string;
  /** 章节 URL */
  url: string;
  /** 是否锁定/VIP */
  isLocked?: boolean;
  /** 更新时间 */
  updateTime?: string;
}
