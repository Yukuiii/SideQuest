/**
 * 书籍服务
 * 提供搜索、获取章节列表、获取内容等功能
 * 仅支持 Legado 格式
 */

import { httpGet, httpPost } from "../../utils/vscode";
import type { UnifiedSource, BookInfo, ChapterInfo, LegadoSource } from "./types";
import { parseRule, executeRule, parseUrlRule } from "./legadoRuleParser";

/**
 * 搜索书籍
 * @param source 书源
 * @param keyword 搜索关键词
 * @returns 书籍列表
 */
export async function searchBooks(source: UnifiedSource, keyword: string): Promise<BookInfo[]> {
  return searchBooksLegado(source.raw, keyword, source.id);
}

/**
 * Legado 格式书源搜索
 */
async function searchBooksLegado(
  source: LegadoSource,
  keyword: string,
  sourceId: string
): Promise<BookInfo[]> {
  if (!source.searchUrl || !source.ruleSearch) {
    throw new Error("书源未配置搜索规则");
  }

  // 解析搜索 URL（传入 baseUrl 用于拼接相对路径）
  const urlRule = parseUrlRule(source.searchUrl, keyword, source.bookSourceUrl);

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

  if (!response.success || !response.data) {
    throw new Error(response.error || "请求失败");
  }

  // 解析 HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(response.data, "text/html");

  // 提取书籍列表
  const rules = source.ruleSearch;
  const bookListRule = parseRule(rules.bookList || "");
  const bookElements = bookListRule.selector
    ? doc.querySelectorAll(bookListRule.selector)
    : [doc.documentElement];

  const books: BookInfo[] = [];

  bookElements.forEach((element) => {
    try {
      const book: BookInfo = {
        name: extractText(element, rules.name) || "",
        author: extractText(element, rules.author),
        coverUrl: extractText(element, rules.coverUrl),
        intro: extractText(element, rules.intro),
        kind: extractText(element, rules.kind),
        lastChapter: extractText(element, rules.lastChapter),
        bookUrl: extractText(element, rules.bookUrl) || "",
        sourceId,
      };

      // 处理相对 URL
      if (book.bookUrl && !book.bookUrl.startsWith("http")) {
        book.bookUrl = new URL(book.bookUrl, source.bookSourceUrl).href;
      }
      if (book.coverUrl && !book.coverUrl.startsWith("http")) {
        book.coverUrl = new URL(book.coverUrl, source.bookSourceUrl).href;
      }

      if (book.name && book.bookUrl) {
        books.push(book);
      }
    } catch (e) {
      console.error("解析书籍失败:", e);
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
  return getChaptersLegado(source.raw, book);
}

/**
 * Legado 格式获取章节
 */
async function getChaptersLegado(source: LegadoSource, book: BookInfo): Promise<ChapterInfo[]> {
  if (!source.ruleToc) {
    throw new Error("书源未配置目录规则");
  }

  // 先获取书籍详情页（可能包含目录 URL）
  let tocUrl = book.bookUrl;

  if (source.ruleBookInfo?.tocUrl) {
    const bookResponse = await httpGet(book.bookUrl);
    if (bookResponse.success && bookResponse.data) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(bookResponse.data, "text/html");
      const extractedTocUrl = extractText(doc.documentElement, source.ruleBookInfo.tocUrl);
      if (extractedTocUrl) {
        tocUrl = extractedTocUrl.startsWith("http")
          ? extractedTocUrl
          : new URL(extractedTocUrl, source.bookSourceUrl).href;
      }
    }
  }

  // 获取目录页
  const response = await httpGet(tocUrl);
  if (!response.success || !response.data) {
    throw new Error(response.error || "获取目录失败");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(response.data, "text/html");

  // 提取章节列表
  const rules = source.ruleToc;
  const chapterListRule = parseRule(rules.chapterList || "");
  const chapterElements = chapterListRule.selector
    ? doc.querySelectorAll(chapterListRule.selector)
    : [];

  const chapters: ChapterInfo[] = [];

  chapterElements.forEach((element) => {
    try {
      const chapter: ChapterInfo = {
        name: extractText(element, rules.chapterName) || "",
        url: extractText(element, rules.chapterUrl) || "",
        isLocked: rules.isVip ? !!extractText(element, rules.isVip) : false,
        updateTime: extractText(element, rules.updateTime) || undefined,
      };

      // 处理相对 URL
      if (chapter.url && !chapter.url.startsWith("http")) {
        chapter.url = new URL(chapter.url, source.bookSourceUrl).href;
      }

      if (chapter.name && chapter.url) {
        chapters.push(chapter);
      }
    } catch (e) {
      console.error("解析章节失败:", e);
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
  return getContentLegado(source.raw, chapter);
}

/**
 * Legado 格式获取内容
 */
async function getContentLegado(source: LegadoSource, chapter: ChapterInfo): Promise<string> {
  if (!source.ruleContent) {
    throw new Error("书源未配置正文规则");
  }

  const response = await httpGet(chapter.url);
  if (!response.success || !response.data) {
    throw new Error(response.error || "获取内容失败");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(response.data, "text/html");

  // 提取内容
  const contentRule = parseRule(source.ruleContent.content || "");
  let content = "";

  if (contentRule.selector) {
    const contentElements = doc.querySelectorAll(contentRule.selector);
    contentElements.forEach((el) => {
      content += el.innerHTML + "\n";
    });
  }

  // 应用替换规则
  if (source.ruleContent.replaceRegex) {
    const replaceRules = source.ruleContent.replaceRegex.split("&&");
    replaceRules.forEach((rule) => {
      const parts = rule.split("##");
      if (parts.length >= 1 && parts[0]) {
        try {
          const regex = new RegExp(parts[0], "g");
          content = content.replace(regex, parts[1] || "");
        } catch {
          // 忽略无效正则
        }
      }
    });
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

  const parsedRule = parseRule(rule);
  const result = executeRule(element, parsedRule);

  if (Array.isArray(result)) {
    return result.join("");
  }

  return result || undefined;
}
