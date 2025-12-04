/**
 * 主题同步与应用
 * - 读取 VS Code 注入的 CSS 变量，构建调色板
 * - 支持锁定浅/深色，缓存各主题下的调色板
 * - 通过消息监听 init/updateTheme，实时更新
 */

import { reactive } from "vue";
import { postMessage } from "../utils/vscode";

/** VS Code 主题类型 */
export type ThemeKind = "light" | "dark" | "highContrast" | "highContrastLight";
/** 主题锁定策略 */
export type LockTheme = "auto" | "light" | "dark";

/** 主题状态 */
export const themeState = reactive({
  kind: "dark" as ThemeKind,
  appliedKind: "dark" as ThemeKind,
  lockTheme: "auto" as LockTheme,
});

/** 需要同步的 VS Code 主题变量列表 */
const THEME_TOKENS = [
  "--vscode-sideBar-background",
  "--vscode-foreground",
  "--vscode-input-background",
  "--vscode-input-foreground",
  "--vscode-input-placeholderForeground",
  "--vscode-descriptionForeground",
  "--vscode-editorWidget-background",
  "--vscode-editor-background",
  "--vscode-panel-border",
  "--vscode-input-border",
  "--vscode-button-background",
  "--vscode-button-foreground",
  "--vscode-button-secondaryBackground",
  "--vscode-button-secondaryForeground",
  "--vscode-button-secondaryHoverBackground",
  "--vscode-button-hoverBackground",
  "--vscode-list-hoverBackground",
  "--vscode-list-activeSelectionBackground",
  "--vscode-toolbar-hoverBackground",
  "--vscode-badge-background",
  "--vscode-badge-foreground",
  "--vscode-textBlockQuote-background",
  "--vscode-textLink-foreground",
  "--vscode-progressBar-background",
  "--vscode-inputValidation-errorBackground",
  "--vscode-inputValidation-errorForeground",
  "--vscode-focusBorder",
  "--vscode-font-family",
  "--vscode-font-size",
];

/** 缓存不同主题类型的调色板，便于锁定模式复用 */
const paletteCache: Partial<Record<ThemeKind, Record<string, string>>> = {};

/**
 * 读取当前 DOM 中的 VS Code CSS 变量，生成调色板
 */
function readPalette(): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  const palette: Record<string, string> = {};

  THEME_TOKENS.forEach((token) => {
    const value = style.getPropertyValue(token).trim();
    if (value) {
      palette[token] = value;
    }
  });

  return palette;
}

/**
 * 应用调色板到根节点
 * - 覆盖常用 VS Code 变量（锁定模式下保持自定义值）
 * - 同步自定义 --sq-* 变量给 Tailwind/组件使用
 */
function applyPalette(palette: Record<string, string>) {
  const root = document.documentElement;
  THEME_TOKENS.forEach((token) => {
    const value = palette[token];
    if (value) {
      root.style.setProperty(token, value);
    }
  });

  // 自定义变量映射，默认回落到常用 VS Code 变量
  const fallback = (token: string, defaultValue: string) =>
    palette[token] || defaultValue;

  root.style.setProperty(
    "--sq-background",
    fallback("--vscode-sideBar-background", "#1e1e1e")
  );
  root.style.setProperty(
    "--sq-foreground",
    fallback("--vscode-foreground", "#d4d4d4")
  );
  root.style.setProperty(
    "--sq-muted",
    fallback("--vscode-input-background", "#1e1e1e")
  );
  root.style.setProperty(
    "--sq-muted-foreground",
    fallback("--vscode-descriptionForeground", "#7f7f7f")
  );
  root.style.setProperty(
    "--sq-popover",
    fallback("--vscode-editorWidget-background", "#252526")
  );
  root.style.setProperty(
    "--sq-popover-foreground",
    fallback("--vscode-foreground", "#d4d4d4")
  );
  root.style.setProperty(
    "--sq-card",
    fallback("--vscode-editor-background", "#1e1e1e")
  );
  root.style.setProperty(
    "--sq-card-foreground",
    fallback("--vscode-foreground", "#d4d4d4")
  );
  root.style.setProperty(
    "--sq-border",
    fallback("--vscode-panel-border", "#3c3c3c")
  );
  root.style.setProperty(
    "--sq-input",
    fallback("--vscode-input-border", "#3c3c3c")
  );
  root.style.setProperty(
    "--sq-primary",
    fallback("--vscode-button-background", "#0e639c")
  );
  root.style.setProperty(
    "--sq-primary-foreground",
    fallback("--vscode-button-foreground", "#ffffff")
  );
  root.style.setProperty(
    "--sq-secondary",
    fallback("--vscode-button-secondaryBackground", "#3a3d41")
  );
  root.style.setProperty(
    "--sq-secondary-foreground",
    fallback("--vscode-button-secondaryForeground", "#ffffff")
  );
  root.style.setProperty(
    "--sq-accent",
    fallback("--vscode-list-hoverBackground", "#2a2d2e")
  );
  root.style.setProperty(
    "--sq-accent-foreground",
    fallback("--vscode-foreground", "#d4d4d4")
  );
  root.style.setProperty("--sq-destructive", "#dc2626");
  root.style.setProperty("--sq-destructive-foreground", "#ffffff");
  root.style.setProperty(
    "--sq-ring",
    fallback("--vscode-focusBorder", "#0078d4")
  );
  root.style.setProperty("--sq-radius", "0.375rem");
}

/**
 * 获取锁定模式下最终使用的主题类型
 */
function resolveAppliedKind(kind: ThemeKind): ThemeKind {
  if (themeState.lockTheme === "light") {
    return paletteCache.light ? "light" : kind;
  }
  if (themeState.lockTheme === "dark") {
    return paletteCache.dark ? "dark" : kind;
  }
  return kind;
}

/**
 * 处理主题更新（init/updateTheme）
 */
function handleThemeMessage(payload: {
  theme?: { kind?: ThemeKind };
  prefs?: { lockTheme?: LockTheme };
}) {
  const nextKind = payload.theme?.kind || themeState.kind;
  if (payload.prefs?.lockTheme) {
    themeState.lockTheme = payload.prefs.lockTheme;
  }

  const palette = readPalette();
  paletteCache[nextKind] = palette;

  const appliedKind = resolveAppliedKind(nextKind);
  const appliedPalette =
    paletteCache[appliedKind] || paletteCache[nextKind] || palette;

  applyPalette(appliedPalette);

  themeState.kind = nextKind;
  themeState.appliedKind = appliedKind;
}

/**
 * 注册主题消息监听并请求初始主题
 */
export function setupThemeBridge() {
  applyPalette(readPalette());

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message !== "object") return;

    if (message.command === "init" || message.command === "updateTheme") {
      handleThemeMessage(message.payload || {});
    }
  });

  postMessage("requestTheme");
}
