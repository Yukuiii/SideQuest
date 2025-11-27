/**
 * 书源模块导出
 */

// 类型定义
export type {
  EsoSource,
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

// ESO 解析器
export {
  parseEsoSource,
  parseEsoSources,
  convertEsoToUnified,
  encodeEsoSource,
  isValidEsoFormat,
} from "./esoParser";

// Legado 解析器
export {
  parseLegadoSource,
  parseLegadoSources,
  parseLegadoSourcesWithErrors,
  convertLegadoToUnified,
  convertLegadoSourcesToUnified,
  encodeLegadoSources,
  isValidLegadoFormat,
  detectSourceFormat,
} from "./legadoParser";

// 规则解析器
export type { ParsedRule, ParsedUrlRule } from "./ruleParser";
export {
  parseRule,
  executeRule,
  executeRuleAll,
  parseAndExecute,
  parseUrlRule,
} from "./ruleParser";

// 书源管理器
export type { ImportResult } from "./sourceManager";
export { SourceManager, sourceManager } from "./sourceManager";
