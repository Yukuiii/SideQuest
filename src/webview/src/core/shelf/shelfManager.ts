/**
 * 书架管理器
 * 负责书架数据的存储和操作
 */

import type { ShelfBook, ShelfData } from "./types";
import { generateBookId } from "../source/bookId";

const STORAGE_KEY = "novel:shelf";
const DEFAULT_SHELF: ShelfData = { books: [] };

/**
 * 加载书架数据
 */
export function loadShelf(): ShelfData {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) {
      const parsed = JSON.parse(json) as ShelfData;
      const migrated = migrateShelf(parsed);
      return migrated;
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
  if (!book.bookInfo.alternativeSources) {
    book.bookInfo.alternativeSources = [];
  }
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

/**
 * 更新备用书源
 */
export function updateAlternativeSources(
  bookUrl: string,
  alternativeSources: ShelfBook["bookInfo"]["alternativeSources"]
): void {
  const shelf = loadShelf();
  const book = shelf.books.find((b) => b.bookInfo.bookUrl === bookUrl);
  if (book) {
    book.bookInfo.alternativeSources = alternativeSources ?? [];
    saveShelf(shelf);
  }
}

/**
 * 替换书籍信息（用于切换书源）
 */
export function replaceBookInfo(
  oldBookUrl: string,
  newBookInfo: ShelfBook["bookInfo"],
  chapterIndex?: number
): void {
  const shelf = loadShelf();
  const book = shelf.books.find((b) => b.bookInfo.bookUrl === oldBookUrl);
  if (book) {
    book.bookInfo = newBookInfo;
    if (typeof chapterIndex === "number") {
      book.chapterIndex = chapterIndex;
    }
    saveShelf(shelf);
  }
}

/**
 * 迁移旧数据，补全 bookId / alternativeSources
 */
function migrateShelf(data: ShelfData): ShelfData {
  let migrated = false;
  const books = data.books.map((item) => {
    const bookInfo = { ...item.bookInfo };

    if (!bookInfo.bookId) {
      bookInfo.bookId = generateBookId(bookInfo.name, bookInfo.author);
      migrated = true;
    }

    if (!bookInfo.alternativeSources) {
      bookInfo.alternativeSources = [];
      migrated = true;
    }

    const updated: ShelfBook = {
      ...item,
      bookInfo,
    };
    return updated;
  });

  if (migrated) {
    const migratedData: ShelfData = { books };
    saveShelf(migratedData);
    return migratedData;
  }

  return data;
}
