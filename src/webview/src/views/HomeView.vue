<script setup lang="ts">
/**
 * 首页视图组件
 * 显示主菜单，用于选择不同功能模式
 */
import { useRouter } from "vue-router";

const router = useRouter();

/** 菜单项配置 */
const menuItems = [
  { id: "novel", icon: "📚", label: "阅读者", desc: "Novel Mode - 沉浸式阅读", route: "/novel" },
  { id: "news", icon: "📰", label: "情报员", desc: "News Mode - 热点聚合", route: "/news" },
  { id: "market", icon: "📈", label: "操盘手", desc: "Market Mode - 盯盘助手", route: "/market" },
];

/**
 * 处理菜单点击
 * @param route 目标路由路径
 */
function handleClick(route: string) {
  router.push(route);
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
        @click="handleClick(item.route)"
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
