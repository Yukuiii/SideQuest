/**
 * 阅读器偏好管理模块
 * 统一管理字号、行高、字重等配置
 */

export interface ReaderPrefs {
  fontSizeIndex: number; // 0-3: [12, 14, 16, 18]
  lineHeightIndex: number; // 0-2: [1.5, 1.7, 1.9]
  fontWeight: "normal" | "bold";
}

// 配置常量
export const FONT_SIZES = [12, 14, 16, 18];
export const LINE_HEIGHTS = [1.5, 1.7, 1.9];
export const PAGE_WIDTHS = [640, 760, 900];

// 存储键
const STORAGE_KEY = "novel:prefs";
const OLD_STORAGE_KEY = "novel-font-size";

// 默认值
const DEFAULT_PREFS: ReaderPrefs = {
  fontSizeIndex: 1, // 14px
  lineHeightIndex: 1, // 1.7
  fontWeight: "normal",
};

/**
 * 加载阅读器偏好
 * 支持从旧版本 novel-font-size 键迁移
 */
export function loadReaderPrefs(): ReaderPrefs {
  try {
    // 尝试加载新格式配置
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) {
      const loaded = JSON.parse(json);
      return { ...DEFAULT_PREFS, ...loaded };
    }

    // 兼容旧版本：迁移 novel-font-size
    const oldFontSize = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldFontSize) {
      const fontSizeIndex = parseInt(oldFontSize, 10);
      if (!isNaN(fontSizeIndex) && fontSizeIndex >= 0 && fontSizeIndex < FONT_SIZES.length) {
        const prefs = { ...DEFAULT_PREFS, fontSizeIndex };
        saveReaderPrefs(prefs);
        localStorage.removeItem(OLD_STORAGE_KEY);
        console.log("[ReaderPrefs] Migrated from old storage key");
        return prefs;
      }
    }
  } catch (err) {
    console.error("[ReaderPrefs] Failed to load reader prefs:", err);
  }

  return { ...DEFAULT_PREFS };
}

/**
 * 保存阅读器偏好
 */
export function saveReaderPrefs(prefs: ReaderPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.error("[ReaderPrefs] Failed to save reader prefs:", err);
  }
}
