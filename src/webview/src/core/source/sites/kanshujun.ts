/**
 * 看书君书源配置
 * 小说网站解析规则
 */

import type { EsoSource } from "../esoTypes";
import { EsoContentType } from "../esoTypes";

/**
 * 看书君书源配置
 */
export const kanshujunSource: EsoSource = {
  id: "builtin-kanshujun",
  name: "看书君",
  host: "https://www.xkanshujun.com",
  contentType: EsoContentType.Novel,
  author: "内置书源",

  // 搜索配置
  enableSearch: true,
  searchUrl: "https://www.sososhu.com/?q={{keyword}}&site=wanopen",
  searchList: ".hot .item",
  searchName: "dl dt a@text",
  searchAuthor: "dl dt span@text",
  searchCover: ".image img@src",
  searchDescription: "dl dd@text",
  searchChapter: "",
  searchResult: "dl dt a@href",

  // 章节列表配置
  // 页面有两个 #list，第一个是最新章节（倒序），第二个是完整列表（正序）
  chapterList: "#list:last-child dd a",
  chapterName: "@text",
  chapterResult: "@href",

  // 正文配置
  contentItems: "#content p@html",
};
