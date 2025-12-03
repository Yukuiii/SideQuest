<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { marketState, requestRefresh, setupMarketBridge } from "../core/market/marketManager";

const router = useRouter();

function goBack() {
  router.push("/");
}

onMounted(() => {
  setupMarketBridge();
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center gap-2 border-b border-[var(--vscode-panel-border)] p-3">
      <button
        class="flex h-6 w-6 items-center justify-center rounded border-none bg-transparent text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] cursor-pointer"
        @click="goBack"
        title="返回"
      >
        ←
      </button>
      <span class="flex-1 font-medium">📈 操盘手</span>
      <button
        class="flex h-6 w-6 items-center justify-center rounded border-none bg-transparent text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] cursor-pointer"
        @click="requestRefresh"
        title="刷新"
      >
        ↻
      </button>
    </div>

    <div class="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-[var(--vscode-descriptionForeground)]">
      <div>功能开发中...</div>
      <div>自选数：{{ marketState.quotes.length }}，最后更新：{{ marketState.lastUpdate ? new Date(marketState.lastUpdate).toLocaleTimeString() : "暂无" }}</div>
    </div>
  </div>
</template>
