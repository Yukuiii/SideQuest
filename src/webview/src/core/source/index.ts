/**
 * 书源模块导出
 * 仅支持 ESO 格式
 */

// 类型定义
export type { UnifiedSource, BookInfo, ChapterInfo } from "./types";

// BookSourceType 是 const 对象和类型的组合，需要分开导出
export { BookSourceType } from "./types";
export type { BookSourceType as BookSourceTypeValue } from "./types";

// ESO 类型定义
export type { EsoSource, EsoParsedRule, EsoParsedUrlRule } from "./esoTypes";
export { EsoContentType } from "./esoTypes";

// ESO 解析器
export {
  parseEsoSource,
  parseEsoSources,
  parseEsoSourcesWithErrors,
  convertEsoToUnified,
  convertEsoSourcesToUnified,
  encodeEsoSources,
  isValidEsoFormat,
  parseEsoRule,
  executeEsoRule,
  executeEsoRuleAll,
  parseAndExecuteEso,
  parseEsoUrlRule,
} from "./esoParser";

// 书源管理器
export type { ImportResult, SourceFormat } from "./sourceManager";
export { SourceManager, sourceManager, detectSourceFormat } from "./sourceManager";

// 书籍服务
export { searchBooks, getChapters, getContent, preloadChapter } from "./bookService";

// 内置书源
export {
  builtinSources,
  getBuiltinSources,
  getBuiltinSourceById,
  isBuiltinSource,
} from "./builtinSources";
