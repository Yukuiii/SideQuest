<script setup lang="ts">
/**
 * 伪装视图组件
 * 展示看起来像日志/堆栈的占位内容
 */
const fakeLogs = [
  "[INFO] 12:30:21 server - Starting incremental compile...",
  "[DEBUG] 12:30:22 cache  - Hit memoized resolver for module utils/helpers.ts",
  "[WARN] 12:30:23 fs     - Slow I/O detected, switching to fallback reader",
  "[INFO] 12:30:24 bundler - Emitting chunk: webview/index.js (23.4kb)",
  "[INFO] 12:30:25 tests  - Running suite: NovelView.spec.ts",
  " PASS  ✓ should render chapter title",
  " PASS  ✓ should handle empty chapter content",
  "[INFO] 12:30:26 lint   - eslint completed without errors",
  "[INFO] 12:30:27 server - Watching for file changes..."
];
</script>

<template>
  <div class="flex h-full flex-col bg-[var(--vscode-editor-background)] p-4 text-xs text-[var(--vscode-foreground)]">
    <div class="mb-2 flex items-center justify-between text-[var(--vscode-descriptionForeground)]">
      <span>Background Task Monitor</span>
      <span class="rounded bg-[var(--vscode-badge-background)] px-2 py-0.5 text-[10px] text-[var(--vscode-badge-foreground)]">
        Live
      </span>
    </div>
    <div class="flex-1 overflow-auto rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-3 font-mono leading-6">
      <div v-for="(line, idx) in fakeLogs" :key="idx" class="whitespace-pre">
        {{ line }}
      </div>
    </div>
  </div>
</template>
