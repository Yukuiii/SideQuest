/**
 * 本地书籍管理器
 * 书籍内容保存在内存中，仅元数据持久化到 localStorage
 */

import type { LocalBook, LocalBookData } from "./types";

/** 内存中的书籍缓存（包含完整内容） */
const booksCache = new Map<string, LocalBook>();

/**
 * 加载本地书籍元数据（不含章节内容）
 */
export function loadLocalBooks(): LocalBookData {
  // 如果内存中有数据，直接返回
  if (booksCache.size > 0) {
    return { books: Array.from(booksCache.values()) };
  }
  return { books: [] };
}

/**
 * 添加本地书籍（保存到内存）
 */
export function addLocalBook(book: LocalBook): void {
  console.log("[LocalManager] 添加书籍到内存:", book.id, book.title);
  console.log("[LocalManager] 章节数:", book.chapters.length);
  
  booksCache.set(book.id, book);
  console.log("[LocalManager] 当前内存中书籍数:", booksCache.size);
}

/**
 * 删除本地书籍
 */
export function removeLocalBook(id: string): void {
  booksCache.delete(id);
  console.log("[LocalManager] 删除书籍:", id);
}

/**
 * 获取本地书籍
 */
export function getLocalBook(id: string): LocalBook | null {
  const book = booksCache.get(id);
  if (!book) {
    console.log("[LocalManager] 未找到书籍:", id);
    console.log("[LocalManager] 当前缓存的书籍 ID:", Array.from(booksCache.keys()));
  }
  return book || null;
}

/**
 * 获取所有本地书籍（用于调试）
 */
export function getAllLocalBooks(): LocalBook[] {
  return Array.from(booksCache.values());
}
