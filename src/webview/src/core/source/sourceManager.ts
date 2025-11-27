/**
 * 书源管理服务
 * 提供书源的增删改查、导入导出等功能
 */

import type { UnifiedSource, LegadoSource, BookSourceType } from "./types";
import {
  parseLegadoSources,
  convertLegadoToUnified,
  encodeLegadoSources,
  isValidLegadoFormat,
} from "./legadoParser";

/** 书源格式类型 */
export type SourceFormat = "legado" | "eso" | "unknown";

/**
 * 检测书源字符串的格式
 * @param sourceString 书源字符串
 * @returns 检测到的格式类型
 */
export function detectSourceFormat(sourceString: string): SourceFormat {
  const trimmed = sourceString.trim();

  // ESO 格式以 eso:// 开头
  if (trimmed.startsWith("eso://")) {
    return "eso";
  }

  // Legado JSON 格式
  if (isValidLegadoFormat(trimmed)) {
    return "legado";
  }

  return "unknown";
}

/** 书源存储键名 */
const STORAGE_KEY = "sidequest_sources";

/**
 * 书源管理器类
 */
export class SourceManager {
  /** 书源列表 */
  private sources: Map<string, UnifiedSource> = new Map();

  /** 变更回调 */
  private onChangeCallbacks: Array<(sources: UnifiedSource[]) => void> = [];

  /**
   * 创建书源管理器实例
   */
  constructor() {
    this.loadFromStorage();
  }

  /**
   * 获取所有书源
   * @returns 书源列表
   */
  getAll(): UnifiedSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * 根据 ID 获取书源
   * @param id 书源 ID
   * @returns 书源对象或 undefined
   */
  getById(id: string): UnifiedSource | undefined {
    return this.sources.get(id);
  }

  /**
   * 根据类型获取书源
   * @param type 书源类型
   * @returns 符合类型的书源列表
   */
  getByType(type: BookSourceType): UnifiedSource[] {
    return this.getAll().filter((source) => source.type === type);
  }

  /**
   * 根据分组获取书源
   * @param group 分组名称
   * @returns 符合分组的书源列表
   */
  getByGroup(group: string): UnifiedSource[] {
    return this.getAll().filter((source) => source.group === group);
  }

  /**
   * 获取所有分组
   * @returns 分组名称列表
   */
  getGroups(): string[] {
    const groups = new Set<string>();
    this.sources.forEach((source) => {
      if (source.group) {
        groups.add(source.group);
      }
    });
    return Array.from(groups).sort();
  }

  /**
   * 添加书源
   * @param source 统一格式书源
   * @returns 是否添加成功
   */
  add(source: UnifiedSource): boolean {
    if (this.sources.has(source.id)) {
      return false;
    }
    this.sources.set(source.id, source);
    this.saveToStorage();
    this.notifyChange();
    return true;
  }

  /**
   * 更新书源
   * @param source 统一格式书源
   * @returns 是否更新成功
   */
  update(source: UnifiedSource): boolean {
    if (!this.sources.has(source.id)) {
      return false;
    }
    this.sources.set(source.id, source);
    this.saveToStorage();
    this.notifyChange();
    return true;
  }

  /**
   * 添加或更新书源
   * @param source 统一格式书源
   */
  upsert(source: UnifiedSource): void {
    this.sources.set(source.id, source);
    this.saveToStorage();
    this.notifyChange();
  }

  /**
   * 删除书源
   * @param id 书源 ID
   * @returns 是否删除成功
   */
  delete(id: string): boolean {
    const result = this.sources.delete(id);
    if (result) {
      this.saveToStorage();
      this.notifyChange();
    }
    return result;
  }

  /**
   * 批量删除书源
   * @param ids 书源 ID 列表
   * @returns 删除数量
   */
  deleteMany(ids: string[]): number {
    let count = 0;
    ids.forEach((id) => {
      if (this.sources.delete(id)) {
        count++;
      }
    });
    if (count > 0) {
      this.saveToStorage();
      this.notifyChange();
    }
    return count;
  }

  /**
   * 清空所有书源
   */
  clear(): void {
    this.sources.clear();
    this.saveToStorage();
    this.notifyChange();
  }

  /**
   * 启用/禁用书源
   * @param id 书源 ID
   * @param enabled 是否启用
   * @returns 是否操作成功
   */
  setEnabled(id: string, enabled: boolean): boolean {
    const source = this.sources.get(id);
    if (!source) {
      return false;
    }
    source.enabled = enabled;
    this.saveToStorage();
    this.notifyChange();
    return true;
  }

  /**
   * 导入书源字符串
   * @param sourceString 书源字符串
   * @returns 导入结果
   */
  import(sourceString: string): ImportResult {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    const format = detectSourceFormat(sourceString);

    switch (format) {
      case "legado":
        return this.importLegado(sourceString, result);

      case "eso":
        // TODO: 实现 ESO 书源导入
        result.errors.push("ESO 格式书源暂不支持，敬请期待");
        return result;

      case "unknown":
      default:
        result.errors.push("无法识别的书源格式，请使用 Legado JSON 格式");
        return result;
    }
  }

  /**
   * 导入 Legado 格式书源
   * @param sourceString Legado JSON 字符串
   * @param result 导入结果对象
   * @returns 导入结果
   */
  private importLegado(sourceString: string, result: ImportResult): ImportResult {
    try {
      const legadoSources = parseLegadoSources(sourceString);
      for (const legadoSource of legadoSources) {
        const unified = convertLegadoToUnified(legadoSource);
        this.upsert(unified);
        result.success++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push(error instanceof Error ? error.message : "解析失败");
    }

    return result;
  }

  /**
   * 导出书源为 Legado JSON 格式
   * @param ids 要导出的书源 ID 列表（为空则导出全部）
   * @returns 导出的 JSON 字符串
   */
  export(ids?: string[]): string {
    const sourcesToExport = ids
      ? ids.map((id) => this.sources.get(id)).filter((s): s is UnifiedSource => !!s)
      : this.getAll();

    const legadoSources = sourcesToExport.map((s) => s.raw as LegadoSource);
    return encodeLegadoSources(legadoSources);
  }

  /**
   * 搜索书源
   * @param keyword 关键词
   * @returns 匹配的书源列表
   */
  search(keyword: string): UnifiedSource[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.getAll().filter(
      (source) =>
        source.name.toLowerCase().includes(lowerKeyword) ||
        source.url.toLowerCase().includes(lowerKeyword) ||
        source.group?.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * 注册变更监听器
   * @param callback 回调函数
   * @returns 取消注册函数
   */
  onChange(callback: (sources: UnifiedSource[]) => void): () => void {
    this.onChangeCallbacks.push(callback);
    return () => {
      const index = this.onChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 从本地存储加载书源
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const sources = JSON.parse(data) as UnifiedSource[];
        sources.forEach((source) => {
          this.sources.set(source.id, source);
        });
      }
    } catch (error) {
      console.error("加载书源失败:", error);
    }
  }

  /**
   * 保存书源到本地存储
   */
  private saveToStorage(): void {
    try {
      const data = JSON.stringify(this.getAll());
      localStorage.setItem(STORAGE_KEY, data);
    } catch (error) {
      console.error("保存书源失败:", error);
    }
  }

  /**
   * 通知变更
   */
  private notifyChange(): void {
    const sources = this.getAll();
    this.onChangeCallbacks.forEach((callback) => {
      try {
        callback(sources);
      } catch (error) {
        console.error("变更回调执行失败:", error);
      }
    });
  }
}

/** 导入结果 */
export interface ImportResult {
  /** 成功数量 */
  success: number;
  /** 失败数量 */
  failed: number;
  /** 错误信息列表 */
  errors: string[];
}

/** 默认书源管理器实例 */
export const sourceManager = new SourceManager();
