/**
 * Legado 书源解析器
 * 支持阅读 App 的 JSON 格式书源
 */

import type { LegadoSource, UnifiedSource, BookSourceType } from "./types";

/**
 * 解析单个 Legado 书源
 * @param jsonString JSON 格式的书源字符串
 * @returns 解析后的 Legado 书源对象
 * @throws 解析失败时抛出错误
 */
export function parseLegadoSource(jsonString: string): LegadoSource {
  try {
    const source = JSON.parse(jsonString) as LegadoSource;

    // 验证必要字段
    if (!source.bookSourceName) {
      throw new Error("缺少书源名称 (bookSourceName)");
    }
    if (!source.bookSourceUrl) {
      throw new Error("缺少书源地址 (bookSourceUrl)");
    }

    return source;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("无效的 JSON 格式");
    }
    throw error;
  }
}

/**
 * 解析 Legado 书源数组
 * @param jsonString JSON 格式的书源数组字符串
 * @returns 解析后的 Legado 书源对象数组
 */
export function parseLegadoSources(jsonString: string): LegadoSource[] {
  try {
    const data = JSON.parse(jsonString);

    // 支持单个对象或数组
    const sources = Array.isArray(data) ? data : [data];

    // 验证并过滤有效书源
    return sources.filter((source): source is LegadoSource => {
      return (
        typeof source === "object" &&
        source !== null &&
        typeof source.bookSourceName === "string" &&
        typeof source.bookSourceUrl === "string"
      );
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("无效的 JSON 格式");
    }
    throw error;
  }
}

/**
 * 批量解析 Legado 书源（带错误信息）
 * @param jsonString JSON 格式的书源字符串
 * @returns 解析结果数组
 */
export function parseLegadoSourcesWithErrors(
  jsonString: string
): Array<{ success: boolean; source?: LegadoSource; error?: string; index: number }> {
  try {
    const data = JSON.parse(jsonString);
    const sources = Array.isArray(data) ? data : [data];

    return sources.map((item, index) => {
      if (typeof item !== "object" || item === null) {
        return { success: false, error: "无效的书源对象", index };
      }

      if (!item.bookSourceName) {
        return { success: false, error: "缺少书源名称", index };
      }

      if (!item.bookSourceUrl) {
        return { success: false, error: "缺少书源地址", index };
      }

      return { success: true, source: item as LegadoSource, index };
    });
  } catch (error) {
    return [
      {
        success: false,
        error: error instanceof Error ? error.message : "解析失败",
        index: 0,
      },
    ];
  }
}

/**
 * 将 Legado 书源转换为统一格式
 * @param legadoSource Legado 书源对象
 * @returns 统一格式的书源对象
 */
export function convertLegadoToUnified(legadoSource: LegadoSource): UnifiedSource {
  // Legado bookSourceType: 0=小说, 1=漫画, 2=有声
  // 内部 BookSourceType: 0=小说, 1=漫画, 2=音频 (一致)
  const type = (legadoSource.bookSourceType ?? 0) as BookSourceType;

  // 生成唯一 ID（使用书源地址的哈希）
  const id = generateSourceId(legadoSource.bookSourceUrl);

  return {
    id,
    name: legadoSource.bookSourceName,
    url: legadoSource.bookSourceUrl,
    type,
    group: legadoSource.bookSourceGroup,
    enabled: legadoSource.enabled ?? true,
    format: "legado",
    raw: legadoSource,
  };
}

/**
 * 批量转换 Legado 书源为统一格式
 * @param legadoSources Legado 书源数组
 * @returns 统一格式的书源数组
 */
export function convertLegadoSourcesToUnified(legadoSources: LegadoSource[]): UnifiedSource[] {
  return legadoSources.map(convertLegadoToUnified);
}

/**
 * 编码 Legado 书源为 JSON 字符串（用于导出）
 * @param sources Legado 书源数组
 * @param pretty 是否格式化输出
 * @returns JSON 字符串
 */
export function encodeLegadoSources(sources: LegadoSource[], pretty = true): string {
  return JSON.stringify(sources, null, pretty ? 2 : undefined);
}

/**
 * 验证是否为有效的 Legado 书源格式
 * @param str 待验证的字符串
 * @returns 是否为有效的 Legado 格式
 */
export function isValidLegadoFormat(str: string): boolean {
  try {
    const data = JSON.parse(str);
    const sources = Array.isArray(data) ? data : [data];

    return sources.some(
      (source) =>
        typeof source === "object" &&
        source !== null &&
        (typeof source.bookSourceName === "string" || typeof source.bookSourceUrl === "string")
    );
  } catch {
    return false;
  }
}

/**
 * 生成书源唯一 ID
 * @param url 书源地址
 * @returns 唯一 ID
 */
function generateSourceId(url: string): string {
  // 简单的哈希函数
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为 32 位整数
  }
  return `legado_${Math.abs(hash).toString(16)}`;
}

/**
 * 检测书源格式（ESO 或 Legado）
 * @param str 书源字符串
 * @returns 格式类型或 null
 */
export function detectSourceFormat(str: string): "eso" | "legado" | null {
  const trimmed = str.trim();

  // ESO 格式以 eso:// 开头
  if (trimmed.startsWith("eso://")) {
    return "eso";
  }

  // 尝试解析为 JSON（Legado 格式）
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    if (isValidLegadoFormat(trimmed)) {
      return "legado";
    }
  }

  return null;
}
