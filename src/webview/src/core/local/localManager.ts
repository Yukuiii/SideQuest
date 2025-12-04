/**
 * 本地书籍管理器
 * 书籍内容保存在内存中，仅元数据持久化到 localStorage
 */

import type { LocalBook, LocalBookData } from "./types";
import { parseTxt, parseEpub } from "./parsers";
import { readLocalFile } from "../../utils/vscode";

/** 本地书籍元数据（保存到 localStorage） */
interface LocalBookMeta {
  id: string;
  filePath: string;
  title: string;
  author?: string;
  type: "epub" | "txt";
  importedAt: number;
}

const META_STORAGE_KEY = "novel:local-books-meta";

/** 内存中的书籍缓存（包含完整内容） */
const booksCache = new Map<string, LocalBook>();

/** 正在加载的书籍 Promise 缓存（避免重复加载） */
const loadingPromises = new Map<string, Promise<LocalBook | null>>();

/**
 * 加载本地书籍元数据列表
 */
export function loadLocalBooksMeta(): LocalBookMeta[] {
  try {
    const json = localStorage.getItem(META_STORAGE_KEY);
    if (json) {
      return JSON.parse(json) as LocalBookMeta[];
    }
  } catch (err) {
    console.error("[LocalManager] Failed to load meta:", err);
  }
  return [];
}

/**
 * 保存本地书籍元数据
 */
export function saveLocalBooksMeta(meta: LocalBookMeta[]): void {
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
  } catch (err) {
    console.error("[LocalManager] Failed to save meta:", err);
  }
}

/**
 * 添加本地书籍元数据
 */
export function addLocalBookMeta(meta: LocalBookMeta): void {
  const list = loadLocalBooksMeta();
  const existingIndex = list.findIndex((m) => m.id === meta.id);
  if (existingIndex >= 0) {
    list[existingIndex] = meta;
  } else {
    list.unshift(meta);
  }
  saveLocalBooksMeta(list);
}

/**
 * 删除本地书籍元数据
 */
export function removeLocalBookMeta(id: string): void {
  const list = loadLocalBooksMeta();
  const filtered = list.filter((m) => m.id !== id);
  saveLocalBooksMeta(filtered);
}

/**
 * 加载本地书籍数据（从内存）
 */
export function loadLocalBooks(): LocalBookData {
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
  removeLocalBookMeta(id);
  console.log("[LocalManager] 删除书籍:", id);
}

/**
 * 获取本地书籍（同步，仅从内存）
 */
export function getLocalBook(id: string): LocalBook | null {
  return booksCache.get(id) || null;
}

/**
 * 获取本地书籍（异步，如果内存中没有会尝试从文件重新加载）
 */
export async function getLocalBookAsync(id: string): Promise<LocalBook | null> {
  // 先检查内存缓存
  const cached = booksCache.get(id);
  if (cached) {
    return cached;
  }

  // 检查是否正在加载
  const loading = loadingPromises.get(id);
  if (loading) {
    return loading;
  }

  // 尝试从文件重新加载
  const metaList = loadLocalBooksMeta();
  const meta = metaList.find((m) => m.id === id);
  if (!meta) {
    console.log("[LocalManager] 未找到书籍元数据:", id);
    return null;
  }

  // 创建加载 Promise
  const loadPromise = reloadLocalBook(meta);
  loadingPromises.set(id, loadPromise);

  try {
    const book = await loadPromise;
    return book;
  } finally {
    loadingPromises.delete(id);
  }
}

/**
 * 从文件重新加载本地书籍
 */
async function reloadLocalBook(meta: LocalBookMeta): Promise<LocalBook | null> {
  try {
    console.log("[LocalManager] 重新加载书籍:", meta.filePath);

    let parsed: { title: string; author?: string; chapters: any[] };
    const fileName = meta.filePath.split(/[/\\]/).pop() || "";

    if (meta.type === "epub") {
      const base64 = await readLocalFile(meta.filePath, "base64");
      const arrayBuffer = base64ToArrayBuffer(base64);
      parsed = await parseEpub(arrayBuffer, fileName);
    } else {
      const content = await readLocalFile(meta.filePath, "utf8");
      parsed = parseTxt(content, fileName);
    }

    const localBook: LocalBook = {
      id: meta.id,
      title: parsed.title,
      author: parsed.author,
      type: meta.type,
      filePath: meta.filePath,
      chapters: parsed.chapters,
      importedAt: meta.importedAt,
    };

    addLocalBook(localBook);
    console.log("[LocalManager] 书籍重新加载成功:", meta.title);
    return localBook;
  } catch (err) {
    console.error("[LocalManager] 重新加载失败:", meta.filePath, err);
    return null;
  }
}

/**
 * Base64 转 ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 获取所有本地书籍（用于调试）
 */
export function getAllLocalBooks(): LocalBook[] {
  return Array.from(booksCache.values());
}
