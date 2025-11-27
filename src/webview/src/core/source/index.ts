/**
 * 书源模块导出
 * 仅支持 Legado 格式
 */

// 类型定义
export type {
  LegadoSource,
  LegadoSearchRule,
  LegadoExploreRule,
  LegadoBookInfoRule,
  LegadoTocRule,
  LegadoContentRule,
  UnifiedSource,
  BookInfo,
  ChapterInfo,
} from "./types";

// BookSourceType 是 const 对象和类型的组合，需要分开导出
export { BookSourceType } from "./types";
export type { BookSourceType as BookSourceTypeValue } from "./types";

// Legado 解析器
export {
  parseLegadoSource,
  parseLegadoSources,
  parseLegadoSourcesWithErrors,
  convertLegadoToUnified,
  convertLegadoSourcesToUnified,
  encodeLegadoSources,
  isValidLegadoFormat,
} from "./legadoParser";

// Legado 规则解析器
export type { ParsedRule, ParsedUrlRule } from "./legadoRuleParser";
export {
  parseRule,
  executeRule,
  executeRuleAll,
  parseAndExecute,
  parseUrlRule,
} from "./legadoRuleParser";

// 书源管理器
export type { ImportResult, SourceFormat } from "./sourceManager";
export { SourceManager, sourceManager, detectSourceFormat } from "./sourceManager";

// 书籍服务
export { searchBooks, getChapters, getContent } from "./bookService";

// 书架服务
export type { ShelfBook } from "./bookshelf";
export { Bookshelf, bookshelf } from "./bookshelf";
