<script setup lang="ts">
/**
 * 阅读者视图组件
 * 提供小说阅读功能
 */
import { useRouter } from "vue-router";

const router = useRouter();

/**
 * 返回首页
 */
function goBack() {
  router.push("/");
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-[var(--vscode-panel-border)] p-3">
      <button
        class="flex h-6 w-6 items-center justify-center rounded border-none bg-transparent text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] cursor-pointer"
        @click="goBack"
        title="返回"
      >
        ←
      </button>
      <span class="font-medium">📚 阅读者</span>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-4">
      <div class="text-center text-[var(--vscode-descriptionForeground)]">
        <p class="mb-4">沉浸式阅读模式</p>
        <p class="text-xs">功能开发中...</p>
      </div>
    </div>
  </div>
</template>
