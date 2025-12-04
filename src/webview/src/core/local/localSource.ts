/**
 * 本地书源适配器
 * 将本地书籍适配为统一的书源接口
 */

import type { UnifiedSource, ChapterInfo } from "../source";
import { getLocalBook, getAllLocalBooks } from "./localManager";

/**
 * 创建本地书源
 */
export function createLocalSource(): UnifiedSource {
  return {
    id: "local",
    name: "本地书籍",
    url: "local://",
    type: 0, // 小说类型
    enabled: true,
    raw: {
      id: "local",
      name: "本地书籍",
      host: "local://",
      contentType: 1, // 小说类型
    },
  };
}

/**
 * 获取本地书籍的章节列表
 */
export function getLocalChapters(bookUrl: string): ChapterInfo[] {
  console.log("[getLocalChapters] 查找书籍:", bookUrl);
  const book = getLocalBook(bookUrl);
  if (!book) {
    console.error("[getLocalChapters] 本地书籍不存在:", bookUrl);
    // 打印所有本地书籍的 ID 以便调试
    const allBooks = getAllLocalBooks();
    console.log("[getLocalChapters] 现有本地书籍:", allBooks.map((b) => b.id));
    throw new Error("本地书籍不存在（可能需要重新导入）");
  }

  return book.chapters.map((chapter) => ({
    name: chapter.title,
    url: `${bookUrl}#${chapter.index}`,
  }));
}

/**
 * 获取本地书籍的章节内容
 */
export function getLocalContent(chapterUrl: string): string {
  // 解析章节 URL: bookId#chapterIndex
  const parts = chapterUrl.split("#");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("无效的章节 URL");
  }

  const [bookId, chapterIndexStr] = parts;
  const chapterIndex = parseInt(chapterIndexStr, 10);

  if (!bookId) {
    throw new Error("无效的书籍 ID");
  }

  console.log("[getLocalContent] 查找书籍:", bookId);
  const book = getLocalBook(bookId);
  if (!book) {
    console.error("[getLocalContent] 本地书籍不存在:", bookId);
    throw new Error("本地书籍不存在");
  }

  const chapter = book.chapters[chapterIndex];
  if (!chapter) {
    throw new Error("章节不存在");
  }

  const content = chapter.content;

  // 如果内容已经是 HTML 格式（包含标签），直接返回
  if (content.includes("<p>") || content.includes("<img") || content.includes("<div")) {
    return content;
  }

  // 否则将纯文本内容转换为 HTML 段落
  return content
    .split(/\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p}</p>`)
    .join("\n");
}
