/**
 * 笔趣阁 (biquge.xin) 书源配置
 * 小说网站解析规则
 */

import type { EsoSource } from "../esoTypes";
import { EsoContentType } from "../esoTypes";

/**
 * 笔趣阁书源配置
 */
export const biqugeSource: EsoSource = {
  id: "builtin-biquge-xin",
  name: "笔趣阁xin",
  host: "https://www.biquge.xin",
  contentType: EsoContentType.Novel,
  author: "内置书源",

  // 搜索配置
  enableSearch: true,
  searchUrl: "/search/result.html?searchtype=novelname&searchkey={{keyword}}",
  searchList: "ul.librarylist li",
  searchName: "span@text",
  searchAuthor: "span:nth-of-type(2) a@text",
  searchCover: "img@src",
  searchDescription: ".intro@text",
  searchChapter: "p:last-of-type@text##最新章节[:：]",
  searchResult: "a@href",

  // 章节列表配置
  chapterList: "ul.three li a",
  chapterName: "@text##【正.*广】",
  chapterResult: "@href",

  // 正文配置
  contentItems: "#chaptercontent p@html",
};
