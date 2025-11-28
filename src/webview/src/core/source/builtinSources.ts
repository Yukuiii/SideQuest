/**
 * 内置 ESO 书源
 * 预置一些常用的书源，用户无需手动导入即可使用
 */

import type { EsoSource } from "./esoTypes";
import { EsoContentType } from "./esoTypes";

// 导入各站点书源配置
import { biqugeSource, kanshujunSource } from "./sites";

/**
 * 内置书源列表
 */
export const builtinSources: EsoSource[] = [
  biqugeSource,
  kanshujunSource,
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
