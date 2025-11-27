<script setup lang="ts">
import { postMessage } from "./utils/vscode";

const menuItems = [
  { id: "novel", icon: "📚", label: "阅读者", desc: "Novel Mode - 沉浸式阅读" },
  { id: "news", icon: "📰", label: "情报员", desc: "News Mode - 热点聚合" },
  { id: "market", icon: "📈", label: "操盘手", desc: "Market Mode - 盯盘助手" },
];

function handleClick(mode: string) {
  postMessage("selectMode", { mode });
}
</script>

<template>
  <div class="p-4">
    <!-- Welcome -->
    <div class="mt-5 text-center">
      <h2 class="mb-2 font-semibold">Side Quest</h2>
      <p class="mb-4 text-[var(--vscode-descriptionForeground)]">主线任务交给 AI，支线任务交给你</p>
    </div>

    <!-- Menu -->
    <div class="mt-5 flex flex-col gap-2">
      <button
        v-for="item in menuItems"
        :key="item.id"
        class="flex items-center gap-2.5 rounded-md border-none bg-[var(--vscode-button-secondaryBackground)] p-3 text-left text-[var(--vscode-button-secondaryForeground)] transition-colors duration-200 hover:bg-[var(--vscode-button-secondaryHoverBackground)] cursor-pointer"
        @click="handleClick(item.id)"
      >
        <span class="text-lg">{{ item.icon }}</span>
        <div>
          <div class="font-medium">{{ item.label }}</div>
          <div class="text-xs text-[var(--vscode-descriptionForeground)]">{{ item.desc }}</div>
        </div>
      </button>
    </div>

    <!-- Status -->
    <div class="mt-5 rounded bg-[var(--vscode-textBlockQuote-background)] p-2 text-xs text-[var(--vscode-descriptionForeground)]">
      ⚔️ 准备开启支线任务...
    </div>
  </div>
</template>

<style>
:root {
  font-family: var(--vscode-font-family, system-ui, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
}
</style>
