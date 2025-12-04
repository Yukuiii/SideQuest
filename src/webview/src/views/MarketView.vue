<script setup lang="ts">
import { onMounted, computed, ref } from "vue";
import { useRouter } from "vue-router";
import { marketState, requestRefresh, setupMarketBridge } from "../core/market/marketManager";
import { postMessage } from "../utils/vscode";

const router = useRouter();
const sortMode = ref<"default" | "changePercent-desc" | "changePercent-asc" | "name">("default");
const showAddForm = ref(false);
const formSymbol = ref("");
const formDisplayName = ref("");
const formType = ref<"stock" | "crypto" | "index">("stock");
const formSourceId = ref("yahoo");

function goBack() {
  router.push("/");
}

function toggleAddForm() {
  showAddForm.value = !showAddForm.value;
}

function submitAddWatch() {
  const symbol = formSymbol.value.trim();
  if (!symbol) {
    return;
  }
  postMessage("market.addWatch", {
    type: formType.value,
    symbol,
    sourceId: formSourceId.value,
    displayName: formDisplayName.value.trim() || undefined,
  });
  formSymbol.value = "";
  formDisplayName.value = "";
  showAddForm.value = false;
}

function removeWatch(symbol: string) {
  const ok = window.confirm(`确定删除 ${symbol} 吗？`);
  if (ok) {
    postMessage("market.removeWatch", { symbol });
  }
}

onMounted(() => {
  setupMarketBridge();
  // 主动请求一次数据
  requestRefresh();
});

const sortedQuotes = computed(() => {
  const list = [...marketState.quotes];
  switch (sortMode.value) {
    case "changePercent-desc":
      return list.sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
    case "changePercent-asc":
      return list.sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0));
    case "name":
      return list.sort((a, b) => (a.displayName || a.symbol).localeCompare(b.displayName || b.symbol));
    default:
      return list;
  }
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
      <select
        class="h-6 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] text-xs text-[var(--vscode-input-foreground)]"
        v-model="sortMode"
        title="排序"
      >
        <option value="default">默认</option>
        <option value="changePercent-desc">涨幅最大</option>
        <option value="changePercent-asc">跌幅最大</option>
        <option value="name">名称</option>
      </select>
      <button
        class="flex h-6 w-6 items-center justify-center rounded border-none bg-transparent text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] cursor-pointer"
        @click="toggleAddForm"
        :title="showAddForm ? '关闭添加' : '添加自选'"
      >
        {{ showAddForm ? "×" : "+" }}
      </button>
    </div>

    <div v-if="showAddForm" class="border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editorWidget-background)] p-3 text-sm flex flex-col gap-2">
      <div class="flex gap-2">
        <input
          v-model="formSymbol"
          class="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1 text-sm text-[var(--vscode-input-foreground)]"
          placeholder="标的代码（如 AAPL 或 BTCUSDT）"
        />
        
        <input
          v-model="formDisplayName"
          class="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1 text-sm text-[var(--vscode-input-foreground)]"
          placeholder="显示名称（可选）"
        />
      </div>
      <div class="flex gap-2 items-center">
        <select
          v-model="formType"
          class="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] text-xs text-[var(--vscode-input-foreground)] px-2 py-1"
        >
          <option value="stock">股票/指数</option>
          <option value="crypto">加密货币</option>
          <option value="index">指数</option>
        </select>
        <select
          v-model="formSourceId"
          class="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] text-xs text-[var(--vscode-input-foreground)] px-2 py-1"
        >
          <option value="yahoo">Yahoo</option>
          <option value="binance">Binance</option>
          <option value="sina">Sina</option>
        </select>
        <div class="flex gap-2 ml-auto">
          <button
            class="rounded bg-[var(--vscode-button-background)] px-3 py-1 text-xs text-[var(--vscode-button-foreground)]"
            @click="submitAddWatch"
          >
            添加
          </button>
          <button
            class="rounded bg-[var(--vscode-button-secondaryBackground)] px-3 py-1 text-xs text-[var(--vscode-button-secondaryForeground)]"
            @click="toggleAddForm"
          >
            取消
          </button>
        </div>
      </div>
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
          v-for="quote in sortedQuotes"
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
          <button
            class="ml-3 rounded bg-transparent px-2 py-1 text-xs text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-toolbar-hoverBackground)]"
            title="移除自选"
            @click="removeWatch(quote.symbol)"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
