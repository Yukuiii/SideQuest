/**
 * 书籍服务
 * 提供搜索、获取章节列表、获取内容等功能
 * 仅支持 ESO 格式
 */

import { httpGet, httpPost } from "../../utils/vscode";
import type { UnifiedSource, BookInfo, ChapterInfo } from "./types";
import type { EsoSource } from "./esoParser";
import { parseEsoRule, executeEsoRule, parseEsoUrlRule } from "./esoParser";
import { getCachedContent, cacheContent } from "../cache/cacheManager";
import { generateBookId } from "./bookId";

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

  // 发起请求（优先使用 URL 规则的 charset，否则使用全局 charset）
  const charset = urlRule.charset || source.charset;
  const response =
    urlRule.method === "POST"
      ? await httpPost(urlRule.url, urlRule.body, {
          headers: urlRule.headers,
          charset,
        })
      : await httpGet(urlRule.url, {
          headers: urlRule.headers,
          charset,
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

  return parseSearchResultsFromDoc(source, doc, sourceId);
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
  console.log("[getChapters] 开始获取章节列表");
  console.log("[getChapters] book.bookUrl:", book.bookUrl);
  console.log("[getChapters] source.host:", source.host);
  console.log("[getChapters] source.charset:", source.charset);

  if (!source.chapterList) {
    throw new Error("书源未配置章节列表规则");
  }

  // 构建章节列表 URL
  let chapterUrl = book.bookUrl;
  if (source.chapterUrl) {
    const urlRule = parseEsoUrlRule(source.chapterUrl, { result: book.bookUrl }, source.host);
    chapterUrl = urlRule.url;
  }
  console.log("[getChapters] 请求 URL:", chapterUrl);

  // 获取目录页（使用全局 charset 配置，添加 Referer）
  const response = await httpGet(chapterUrl, {
    charset: source.charset,
    headers: {
      Referer: source.host + "/",
    },
  });

  console.log("[getChapters] 响应状态:", response.success, response.statusCode);
  if (!response.success || !response.data) {
    console.log("[getChapters] 请求失败:", response.error);
    throw new Error(response.error || "获取目录失败");
  }
  console.log("[getChapters] 响应长度:", response.data.length);

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
 * 预加载章节内容（静默加载，不抛出错误）
 * @param source 书源
 * @param chapter 章节信息
 */
export async function preloadChapter(source: UnifiedSource, chapter: ChapterInfo): Promise<void> {
  try {
    console.log("[preloadChapter] 开始预加载:", chapter.name);
    await getContentEso(source.raw, chapter);
    console.log("[preloadChapter] 预加载成功:", chapter.name);
  } catch (err) {
    console.warn("[preloadChapter] 预加载失败:", chapter.name, err);
  }
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

  // 先检查缓存
  const cached = getCachedContent(contentUrl);
  if (cached) {
    console.log("[getContent] 使用缓存内容:", contentUrl);
    return cached;
  }

  // 缓存未命中，发起请求
  console.log("[getContent] 缓存未命中，请求:", contentUrl);
  const response = await httpGet(contentUrl, {
    charset: source.charset,
    headers: {
      Referer: source.host + "/",
    },
  });
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

  // 保存到缓存
  if (content) {
    cacheContent(contentUrl, content);
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

/**
 * 解析搜索结果（DOM）为 BookInfo 列表
 */
function parseSearchResultsFromDoc(
  source: EsoSource,
  doc: Document,
  sourceId: string
): BookInfo[] {
  if (!source.searchList) {
    throw new Error("书源未配置搜索列表规则");
  }
  const searchListRule = source.searchList;
  // 提取书籍列表
  const listRule = parseEsoRule(searchListRule);
  console.log("[searchBooks] 列表选择器:", searchListRule, "解析结果:", listRule);

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
      const name = extractText(element, source.searchName) || "";
      const author = extractText(element, source.searchAuthor);
      const bookUrlRaw = extractText(element, source.searchResult) || "";
      const coverUrlRaw = extractText(element, source.searchCover);

      let bookUrl = bookUrlRaw;
      let coverUrl = coverUrlRaw;

      // 处理相对 URL
      if (bookUrl && !bookUrl.startsWith("http")) {
        bookUrl = new URL(bookUrl, source.host).href;
      }
      if (coverUrl && !coverUrl.startsWith("http")) {
        coverUrl = new URL(coverUrl, source.host).href;
      }

      if (!name || !bookUrl) {
        return;
      }

      const book: BookInfo = {
        bookId: generateBookId(name, author),
        name,
        author,
        coverUrl,
        intro: extractText(element, source.searchDescription),
        lastChapter: extractText(element, source.searchChapter),
        bookUrl,
        sourceId,
        alternativeSources: [],
      };

      books.push(book);
    } catch {
      // 解析书籍失败，跳过
    }
  });

  return books;
}

/**
 * 解析搜索结果（HTML 字符串）为 BookInfo 列表
 */
export function parseSearchResults(source: UnifiedSource, rawHtml: string): BookInfo[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");
  return parseSearchResultsFromDoc(source.raw, doc, source.id);
}
