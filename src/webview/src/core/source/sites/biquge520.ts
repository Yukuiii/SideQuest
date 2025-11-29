/**
 * 笔趣阁 (b520.cc) 书源配置
 * 小说网站解析规则
 */

import type { EsoSource } from "../esoTypes";
import { EsoContentType } from "../esoTypes";

/**
 * 笔趣阁520书源配置
 * host: http://www.b520.cc
 * 编码: GBK
 */
export const biquge520Source: EsoSource = {
  id: "builtin-biquge-520",
  name: "笔趣阁520",
  host: "http://www.b520.cc",
  contentType: EsoContentType.Novel,
  author: "内置书源",

  // 搜索配置
  enableSearch: true,
  searchUrl:
    '/modules/article/search.php?searchkey={{keyword}}&searchtype=articlename,{"charset":"gbk","headers":{"Referer":"http://www.b520.cc/"}}',
  searchList: "table.grid tr:not(:first-child)",
  searchName: "td:first-child a@text",
  searchAuthor: "td:nth-child(3)@text",
  searchChapter: "td:nth-child(2) a@text",
  searchResult: "td:first-child a@href",

  // 章节列表配置
  chapterList: "#list dl dd a",
  chapterName: "@text",
  chapterResult: "@href",

  // 正文配置
  contentItems: "#content@html",
};
