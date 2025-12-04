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

    <div class="flex flex-1 flex-col gap-2 p-3">
      <div class="text-xs text-[var(--vscode-descriptionForeground)]">
        自选数：{{ marketState.quotes.length }} · 最后更新：{{ marketState.lastUpdate ? new Date(marketState.lastUpdate).toLocaleTimeString() : "暂无" }}
      </div>
      <div v-if="marketState.quotes.length === 0" class="flex flex-1 items-center justify-center text-sm text-[var(--vscode-descriptionForeground)]">
        暂无行情，请配置自选或稍后重试
      </div>
      <div v-else class="flex flex-col gap-2 overflow-auto">
        <div
          v-for="quote in marketState.quotes"
          :key="quote.symbol"
          class="flex items-center justify-between rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] px-3 py-2 text-sm"
        >
          <div class="flex flex-col">
            <span class="font-medium">{{ quote.displayName || quote.symbol }}</span>
            <span class="text-[var(--vscode-descriptionForeground)] text-xs">{{ quote.symbol }}</span>
          </div>
          <div class="text-right">
            <div class="font-semibold">{{ quote.price?.toFixed ? quote.price.toFixed(2) : quote.price }}</div>
            <div
              class="text-xs"
              :class="quote.changePercent > 0 ? 'text-[var(--vscode-charts-green)]' : quote.changePercent < 0 ? 'text-[var(--vscode-charts-red)]' : 'text-[var(--vscode-descriptionForeground)]'"
            >
              <span>{{ quote.change >= 0 ? '▲' : '▼' }}</span>
              <span>{{ Math.abs(quote.changePercent || 0).toFixed(2) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
