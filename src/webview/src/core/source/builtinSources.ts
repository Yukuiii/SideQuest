/**
 * 内置 ESO 书源
 * 预置一些常用的书源，用户无需手动导入即可使用
 */

import type { EsoSource } from "./esoTypes";
import { EsoContentType } from "./esoTypes";

/**
 * 内置书源列表
 */
export const builtinSources: EsoSource[] = [
  {
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
  },
];

/**
 * 获取所有内置书源
 * @returns 内置书源列表
 */
export function getBuiltinSources(): EsoSource[] {
  return [...builtinSources];
}

/**
 * 根据 ID 获取内置书源
 * @param id 书源 ID
 * @returns 书源对象或 undefined
 */
export function getBuiltinSourceById(id: string): EsoSource | undefined {
  return builtinSources.find((source) => source.id === id);
}

/**
 * 检查是否为内置书源
 * @param id 书源 ID
 * @returns 是否为内置书源
 */
export function isBuiltinSource(id: string): boolean {
  return builtinSources.some((source) => source.id === id);
}

// 导出内容类型常量，方便定义书源时使用
export { EsoContentType };
