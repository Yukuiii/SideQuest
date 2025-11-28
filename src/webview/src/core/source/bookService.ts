/**
 * 书籍服务
 * 提供搜索、获取章节列表、获取内容等功能
 * 仅支持 ESO 格式
 */

import { httpGet, httpPost } from "../../utils/vscode";
import type { UnifiedSource, BookInfo, ChapterInfo } from "./types";
import type { EsoSource } from "./esoParser";
import { parseEsoRule, executeEsoRule, parseEsoUrlRule } from "./esoParser";

/**
 * 搜索书籍
 * @param source 书源
 * @param keyword 搜索关键词
 * @returns 书籍列表
 */
export async function searchBooks(source: UnifiedSource, keyword: string): Promise<BookInfo[]> {
  return searchBooksEso(source.raw, keyword, source.id);
}

/**
 * ESO 格式书源搜索
 */
async function searchBooksEso(
  source: EsoSource,
  keyword: string,
  sourceId: string
): Promise<BookInfo[]> {
  if (!source.searchUrl || !source.searchList) {
    throw new Error("书源未配置搜索规则");
  }

  // 解析搜索 URL
  const urlRule = parseEsoUrlRule(source.searchUrl, { keyword }, source.host);
  console.log("[searchBooks] 请求 URL:", urlRule.url);

  // 发起请求
  const response =
    urlRule.method === "POST"
      ? await httpPost(urlRule.url, urlRule.body, {
          headers: urlRule.headers,
          charset: urlRule.charset,
        })
      : await httpGet(urlRule.url, {
          headers: urlRule.headers,
          charset: urlRule.charset,
        });

  console.log("[searchBooks] 响应状态码:", response.statusCode);
  console.log("[searchBooks] 响应内容前 2000 字符:", response.data?.substring(0, 2000));
  if (!response.success || !response.data) {
    console.log("[searchBooks] 请求失败:", response.error);
    throw new Error(response.error || "请求失败");
  }
  console.log("[searchBooks] 响应长度:", response.data.length);

  // 解析 HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(response.data, "text/html");

  // 提取书籍列表
  const listRule = parseEsoRule(source.searchList);
  console.log("[searchBooks] 列表选择器:", source.searchList, "解析结果:", listRule);

  let bookElements: Element[] = [];
  if (listRule.type === "css" && listRule.selector) {
    try {
      bookElements = Array.from(doc.querySelectorAll(listRule.selector));
    } catch {
      // CSS 选择器无效
    }
  }
  console.log("[searchBooks] 找到书籍元素数量:", bookElements.length);

  const books: BookInfo[] = [];

  bookElements.forEach((element) => {
    try {
      const book: BookInfo = {
        name: extractText(element, source.searchName) || "",
        author: extractText(element, source.searchAuthor),
        coverUrl: extractText(element, source.searchCover),
        intro: extractText(element, source.searchDescription),
        lastChapter: extractText(element, source.searchChapter),
        bookUrl: extractText(element, source.searchResult) || "",
        sourceId,
      };

      // 处理相对 URL
      if (book.bookUrl && !book.bookUrl.startsWith("http")) {
        book.bookUrl = new URL(book.bookUrl, source.host).href;
      }
      if (book.coverUrl && !book.coverUrl.startsWith("http")) {
        book.coverUrl = new URL(book.coverUrl, source.host).href;
      }

      if (book.name && book.bookUrl) {
        books.push(book);
      }
    } catch {
      // 解析书籍失败，跳过
    }
  });

  return books;
}

/**
 * 获取章节列表
 * @param source 书源
 * @param book 书籍信息
 * @returns 章节列表
 */
export async function getChapters(source: UnifiedSource, book: BookInfo): Promise<ChapterInfo[]> {
  return getChaptersEso(source.raw, book);
}

/**
 * ESO 格式获取章节
 */
async function getChaptersEso(source: EsoSource, book: BookInfo): Promise<ChapterInfo[]> {
  if (!source.chapterList) {
    throw new Error("书源未配置章节列表规则");
  }

  // 构建章节列表 URL
  let chapterUrl = book.bookUrl;
  if (source.chapterUrl) {
    const urlRule = parseEsoUrlRule(source.chapterUrl, { result: book.bookUrl }, source.host);
    chapterUrl = urlRule.url;
  }

  // 获取目录页
  const response = await httpGet(chapterUrl);

  if (!response.success || !response.data) {
    throw new Error(response.error || "获取目录失败");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(response.data, "text/html");

  // 提取章节列表
  const listRule = parseEsoRule(source.chapterList);

  let chapterElements: Element[] = [];
  if (listRule.type === "css" && listRule.selector) {
    try {
      chapterElements = Array.from(doc.querySelectorAll(listRule.selector));
    } catch {
      // CSS 选择器无效
    }
  }

  const chapters: ChapterInfo[] = [];

  chapterElements.forEach((element) => {
    try {
      const chapter: ChapterInfo = {
        name: extractText(element, source.chapterName) || "",
        url: extractText(element, source.chapterResult) || "",
        updateTime: extractText(element, source.chapterTime) || undefined,
      };

      // 处理相对 URL
      if (chapter.url && !chapter.url.startsWith("http")) {
        chapter.url = new URL(chapter.url, source.host).href;
      }

      if (chapter.name && chapter.url) {
        chapters.push(chapter);
      }
    } catch {
      // 解析章节失败，跳过
    }
  });

  return chapters;
}

/**
 * 获取章节内容
 * @param source 书源
 * @param chapter 章节信息
 * @returns 章节内容（HTML 或纯文本）
 */
export async function getContent(source: UnifiedSource, chapter: ChapterInfo): Promise<string> {
  return getContentEso(source.raw, chapter);
}

/**
 * ESO 格式获取内容
 */
async function getContentEso(source: EsoSource, chapter: ChapterInfo): Promise<string> {
  if (!source.contentItems) {
    throw new Error("书源未配置正文规则");
  }

  // 构建正文 URL
  let contentUrl = chapter.url;
  if (source.contentUrl) {
    const urlRule = parseEsoUrlRule(source.contentUrl, { result: chapter.url }, source.host);
    contentUrl = urlRule.url;
  }

  const response = await httpGet(contentUrl);
  if (!response.success || !response.data) {
    throw new Error(response.error || "获取内容失败");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(response.data, "text/html");

  // 提取内容
  const contentRule = parseEsoRule(source.contentItems);
  let content = "";

  if (contentRule.type === "css" && contentRule.selector) {
    // 使用 querySelectorAll 选择所有匹配元素
    const contentElements = doc.querySelectorAll(contentRule.selector);
    if (contentElements.length > 0) {
      const contents: string[] = [];
      contentElements.forEach((element) => {
        const text = contentRule.attr === "text"
          ? element.textContent || ""
          : element.innerHTML;
        if (text.trim()) {
          // 用 <p> 标签包裹每个段落，确保 HTML 渲染时换行
          contents.push(`<p>${text}</p>`);
        }
      });
      content = contents.join("");
    }
  } else {
    // 尝试直接执行规则
    const result = executeEsoRule(doc.documentElement, contentRule);
    if (result) {
      content = Array.isArray(result) ? result.join("\n") : result;
    }
  }

  return content;
}

/**
 * 辅助函数：从元素提取文本
 * @param element DOM 元素
 * @param rule 规则字符串
 * @returns 提取的文本
 */
function extractText(element: Element, rule?: string): string | undefined {
  if (!rule) {
    return undefined;
  }

  const parsedRule = parseEsoRule(rule);
  const result = executeEsoRule(element, parsedRule);

  if (Array.isArray(result)) {
    return result.join("");
  }

  return result || undefined;
}
