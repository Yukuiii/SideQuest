/**
 * ESO 书源解析器
 * 格式: eso://:书源名@Base64(Gzip(JSON))
 */

import pako from "pako";
import type { EsoSource, UnifiedSource } from "./types";
import { BookSourceType } from "./types";

/** ESO 协议前缀 */
const ESO_PREFIX = "eso://";

/**
 * 解析 ESO 书源字符串
 * @param esoString ESO 格式的书源字符串
 * @returns 解析后的 ESO 书源对象
 * @throws 解析失败时抛出错误
 */
export function parseEsoSource(esoString: string): EsoSource {
  // 验证前缀
  if (!esoString.startsWith(ESO_PREFIX)) {
    throw new Error("无效的 ESO 书源格式：缺少 eso:// 前缀");
  }

  // 移除前缀，获取 :书源名@Base64数据 部分
  const content = esoString.slice(ESO_PREFIX.length);

  // 查找 @ 分隔符
  const atIndex = content.indexOf("@");
  if (atIndex === -1) {
    throw new Error("无效的 ESO 书源格式：缺少 @ 分隔符");
  }

  // 获取 Base64 编码的数据
  const base64Data = content.slice(atIndex + 1);
  if (!base64Data) {
    throw new Error("无效的 ESO 书源格式：缺少 Base64 数据");
  }

  try {
    // Base64 解码
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Gzip 解压
    const decompressed = pako.ungzip(bytes, { to: "string" });

    // JSON 解析
    const source = JSON.parse(decompressed) as EsoSource;

    return source;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`ESO 书源解析失败：${error.message}`);
    }
    throw new Error("ESO 书源解析失败：未知错误");
  }
}

/**
 * 批量解析 ESO 书源
 * @param esoStrings ESO 格式的书源字符串数组
 * @returns 解析结果数组，包含成功和失败的信息
 */
export function parseEsoSources(
  esoStrings: string[]
): Array<{ success: boolean; source?: EsoSource; error?: string }> {
  return esoStrings.map((str) => {
    try {
      const source = parseEsoSource(str);
      return { success: true, source };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });
}

/**
 * 将 ESO 书源转换为统一格式
 * @param esoSource ESO 书源对象
 * @returns 统一格式的书源对象
 */
export function convertEsoToUnified(esoSource: EsoSource): UnifiedSource {
  // ESO contentType 映射到内部类型
  // ESO: 0=漫画, 1=小说, 2=视频, 3=音频
  // 内部: 0=小说, 1=漫画, 2=音频
  const typeMap: Record<number, BookSourceType> = {
    0: BookSourceType.Comic, // 漫画 -> Comic
    1: BookSourceType.Novel, // 小说 -> Novel
    2: BookSourceType.Audio, // 视频 -> Audio (暂时映射到音频)
    3: BookSourceType.Audio, // 音频 -> Audio
  };

  const contentType = esoSource.contentType ?? 1;

  return {
    id: esoSource.id,
    name: esoSource.name,
    url: esoSource.host,
    type: typeMap[contentType] ?? BookSourceType.Novel,
    group: esoSource.group,
    enabled: true,
    format: "eso",
    raw: esoSource,
  };
}

/**
 * 编码 ESO 书源（用于导出）
 * @param source ESO 书源对象
 * @returns ESO 格式的书源字符串
 */
export function encodeEsoSource(source: EsoSource): string {
  // JSON 序列化
  const jsonString = JSON.stringify(source);

  // Gzip 压缩
  const compressed = pako.gzip(jsonString);

  // Base64 编码
  const binaryString = Array.from(compressed, (byte) => String.fromCharCode(byte)).join("");
  const base64Data = btoa(binaryString);

  // 组装 ESO 格式字符串
  return `${ESO_PREFIX}:${source.name}@${base64Data}`;
}

/**
 * 验证 ESO 书源字符串格式
 * @param str 待验证的字符串
 * @returns 是否为有效的 ESO 格式
 */
export function isValidEsoFormat(str: string): boolean {
  if (!str.startsWith(ESO_PREFIX)) {
    return false;
  }

  const content = str.slice(ESO_PREFIX.length);
  const atIndex = content.indexOf("@");

  return atIndex > 0 && content.length > atIndex + 1;
}
