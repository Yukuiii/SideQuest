/**
 * 书架类型定义
 */

import type { BookInfo } from "../source";

/**
 * 书架中的书籍
 */
export interface ShelfBook {
  /** 书籍信息 */
  bookInfo: BookInfo;
  /** 阅读状态 */
  status: "reading" | "finished";
  /** 当前章节索引 */
  chapterIndex: number;
  /** 总章节数 */
  totalChapters: number;
  /** 滚动位置（像素） */
  scrollPosition: number;
  /** 添加时间 */
  addedAt: number;
  /** 最后阅读时间 */
  lastReadAt: number;
}

/**
 * 书架数据
 */
export interface ShelfData {
  books: ShelfBook[];
}
