<script setup lang="ts">
import { computed } from "vue";
import type { ReaderPrefs } from "../utils/readerPrefs";
import { FONT_SIZES, LINE_HEIGHTS } from "../utils/readerPrefs";

interface Props {
  prefs: ReaderPrefs;
}

interface Emits {
  (e: "update:prefs", value: ReaderPrefs): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 当前配置显示标签
const fontSizeLabel = computed(() => `${FONT_SIZES[props.prefs.fontSizeIndex] ?? 14}px`);
const lineHeightLabel = computed(() => (LINE_HEIGHTS[props.prefs.lineHeightIndex] ?? 1.7).toFixed(1));
const fontWeightLabel = computed(() => (props.prefs.fontWeight === "bold" ? "粗体" : "常规"));

/**
 * 循环切换字号
 */
function cycleFontSize() {
  const nextIndex = (props.prefs.fontSizeIndex + 1) % FONT_SIZES.length;
  emit("update:prefs", { ...props.prefs, fontSizeIndex: nextIndex });
}

/**
 * 循环切换行高
 */
function cycleLineHeight() {
  const nextIndex = (props.prefs.lineHeightIndex + 1) % LINE_HEIGHTS.length;
  emit("update:prefs", { ...props.prefs, lineHeightIndex: nextIndex });
}

/**
 * 切换字重
 */
function toggleFontWeight() {
  const nextWeight = props.prefs.fontWeight === "normal" ? "bold" : "normal";
  emit("update:prefs", { ...props.prefs, fontWeight: nextWeight });
}
</script>

<template>
  <div
    class="flex items-center gap-2 border-b border-[var(--vscode-panel-border)] px-4 py-2 text-xs"
  >
    <button
      class="rounded px-2 py-1 hover:bg-[var(--vscode-list-hoverBackground)]"
      @click="cycleFontSize"
      title="字号 (快捷键: F)"
    >
      字号: {{ fontSizeLabel }}
    </button>
    <button
      class="rounded px-2 py-1 hover:bg-[var(--vscode-list-hoverBackground)]"
      @click="cycleLineHeight"
      title="行高"
    >
      行高: {{ lineHeightLabel }}
    </button>
    <button
      class="rounded px-2 py-1 hover:bg-[var(--vscode-list-hoverBackground)]"
      @click="toggleFontWeight"
      title="字重"
    >
      {{ fontWeightLabel }}
    </button>
    <div class="ml-auto text-[var(--vscode-descriptionForeground)]">
      快捷键:  D 目录 | F 字号 | B 隐藏
    </div>
  </div>
</template>
