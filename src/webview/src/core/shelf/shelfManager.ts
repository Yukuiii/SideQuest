/**
 * 书架管理器
 * 负责书架数据的存储和操作
 */

import type { ShelfBook, ShelfData } from "./types";

const STORAGE_KEY = "novel:shelf";
const DEFAULT_SHELF: ShelfData = { books: [] };

/**
 * 加载书架数据
 */
export function loadShelf(): ShelfData {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) {
      return JSON.parse(json);
    }
  } catch (err) {
    console.error("[ShelfManager] Failed to load shelf:", err);
  }
  return { ...DEFAULT_SHELF };
}

/**
 * 保存书架数据
 */
export function saveShelf(data: ShelfData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("[ShelfManager] Failed to save shelf:", err);
  }
}

/**
 * 添加书籍到书架（如果已存在则更新）
 */
export function addToShelf(book: ShelfBook): void {
  const shelf = loadShelf();
  const existingIndex = shelf.books.findIndex(
    (b) => b.bookInfo.bookUrl === book.bookInfo.bookUrl
  );
  if (existingIndex >= 0) {
    shelf.books[existingIndex] = book;
  } else {
    shelf.books.unshift(book);
  }
  saveShelf(shelf);
}

/**
 * 从书架移除书籍
 */
export function removeFromShelf(bookUrl: string): void {
  const shelf = loadShelf();
  shelf.books = shelf.books.filter((b) => b.bookInfo.bookUrl !== bookUrl);
  saveShelf(shelf);
}

/**
 * 更新阅读进度
 */
export function updateProgress(
  bookUrl: string,
  chapterIndex: number,
  scrollPosition: number,
  totalChapters: number
): void {
  const shelf = loadShelf();
  const book = shelf.books.find((b) => b.bookInfo.bookUrl === bookUrl);
  if (book) {
    book.chapterIndex = chapterIndex;
    book.scrollPosition = scrollPosition;
    book.totalChapters = totalChapters;
    book.lastReadAt = Date.now();
    saveShelf(shelf);
  }
}

/**
 * 获取书籍的阅读进度
 */
export function getBookProgress(bookUrl: string): ShelfBook | null {
  const shelf = loadShelf();
  return shelf.books.find((b) => b.bookInfo.bookUrl === bookUrl) || null;
}
