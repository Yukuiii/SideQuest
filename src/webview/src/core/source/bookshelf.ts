/**
 * 书架服务
 * 管理本地收藏的书籍和阅读进度
 */

import type { BookInfo, ChapterInfo } from "./types";

/** 书架存储键名 */
const BOOKSHELF_KEY = "sidequest_bookshelf";
/** 章节缓存存储键名前缀 */
const CHAPTER_CACHE_PREFIX = "sidequest_chapters_";
/** 内容缓存存储键名前缀 */
const CONTENT_CACHE_PREFIX = "sidequest_content_";

/** 书架中的书籍信息（带阅读进度） */
export interface ShelfBook extends BookInfo {
  /** 添加时间 */
  addTime: number;
  /** 最后阅读时间 */
  lastReadTime?: number;
  /** 最后阅读章节索引 */
  lastChapterIndex?: number;
  /** 最后阅读章节名称 */
  lastChapterName?: string;
  /** 阅读进度百分比 */
  progress?: number;
}

/**
 * 书架管理类
 */
export class Bookshelf {
  private static instance: Bookshelf;
  /** 书架书籍列表 */
  private books: Map<string, ShelfBook> = new Map();
  /** 变更回调 */
  private onChangeCallbacks: Array<(books: ShelfBook[]) => void> = [];

  private constructor() {
    this.loadFromStorage();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): Bookshelf {
    if (!Bookshelf.instance) {
      Bookshelf.instance = new Bookshelf();
    }
    return Bookshelf.instance;
  }

  /**
   * 获取书架所有书籍
   */
  public getAll(): ShelfBook[] {
    return Array.from(this.books.values()).sort((a, b) => {
      // 按最后阅读时间排序，未阅读的按添加时间
      const timeA = a.lastReadTime || a.addTime;
      const timeB = b.lastReadTime || b.addTime;
      return timeB - timeA;
    });
  }

  /**
   * 根据 URL 获取书籍
   */
  public getByUrl(bookUrl: string): ShelfBook | undefined {
    return this.books.get(bookUrl);
  }

  /**
   * 检查书籍是否在书架中
   */
  public has(bookUrl: string): boolean {
    return this.books.has(bookUrl);
  }

  /**
   * 添加书籍到书架
   */
  public add(book: BookInfo): ShelfBook {
    const shelfBook: ShelfBook = {
      ...book,
      addTime: Date.now(),
    };
    this.books.set(book.bookUrl, shelfBook);
    this.saveToStorage();
    this.notifyChange();
    return shelfBook;
  }

  /**
   * 从书架移除书籍
   */
  public remove(bookUrl: string): boolean {
    const result = this.books.delete(bookUrl);
    if (result) {
      // 同时清除章节和内容缓存
      this.clearBookCache(bookUrl);
      this.saveToStorage();
      this.notifyChange();
    }
    return result;
  }

  /**
   * 更新阅读进度
   */
  public updateProgress(
    bookUrl: string,
    chapterIndex: number,
    chapterName: string,
    totalChapters: number
  ): void {
    const book = this.books.get(bookUrl);
    if (book) {
      book.lastReadTime = Date.now();
      book.lastChapterIndex = chapterIndex;
      book.lastChapterName = chapterName;
      book.progress = Math.round((chapterIndex / totalChapters) * 100);
      this.saveToStorage();
      this.notifyChange();
    }
  }

  /**
   * 缓存章节列表
   */
  public cacheChapters(bookUrl: string, chapters: ChapterInfo[]): void {
    try {
      const key = CHAPTER_CACHE_PREFIX + this.hashUrl(bookUrl);
      localStorage.setItem(key, JSON.stringify(chapters));
    } catch (e) {
      console.error("缓存章节列表失败:", e);
    }
  }

  /**
   * 获取缓存的章节列表
   */
  public getCachedChapters(bookUrl: string): ChapterInfo[] | null {
    try {
      const key = CHAPTER_CACHE_PREFIX + this.hashUrl(bookUrl);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * 缓存章节内容
   */
  public cacheContent(chapterUrl: string, content: string): void {
    try {
      const key = CONTENT_CACHE_PREFIX + this.hashUrl(chapterUrl);
      localStorage.setItem(key, content);
    } catch (e) {
      console.error("缓存章节内容失败:", e);
    }
  }

  /**
   * 获取缓存的章节内容
   */
  public getCachedContent(chapterUrl: string): string | null {
    try {
      const key = CONTENT_CACHE_PREFIX + this.hashUrl(chapterUrl);
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /**
   * 注册变更监听器
   */
  public onChange(callback: (books: ShelfBook[]) => void): () => void {
    this.onChangeCallbacks.push(callback);
    return () => {
      const index = this.onChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 从存储加载
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(BOOKSHELF_KEY);
      if (data) {
        const books = JSON.parse(data) as ShelfBook[];
        books.forEach((book) => {
          this.books.set(book.bookUrl, book);
        });
      }
    } catch (e) {
      console.error("加载书架失败:", e);
    }
  }

  /**
   * 保存到存储
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(BOOKSHELF_KEY, JSON.stringify(this.getAll()));
    } catch (e) {
      console.error("保存书架失败:", e);
    }
  }

  /**
   * 清除书籍缓存
   */
  private clearBookCache(bookUrl: string): void {
    const hash = this.hashUrl(bookUrl);
    // 清除章节缓存
    localStorage.removeItem(CHAPTER_CACHE_PREFIX + hash);
    // 注意：内容缓存由于 key 是章节 URL，无法直接清除
  }

  /**
   * 通知变更
   */
  private notifyChange(): void {
    const books = this.getAll();
    this.onChangeCallbacks.forEach((callback) => {
      try {
        callback(books);
      } catch (e) {
        console.error("变更回调执行失败:", e);
      }
    });
  }

  /**
   * 简单的 URL 哈希
   */
  private hashUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

/** 默认书架实例 */
export const bookshelf = Bookshelf.getInstance();
