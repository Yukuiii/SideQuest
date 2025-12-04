<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import KLineChart from "../components/KLineChart.vue";
import type { KLineInterval, KLineRange, ChartType } from "../core/market/types";
import { getIntervalLabel, getRangeLabel } from "../core/market/klineService";
import { marketState } from "../core/market/marketManager";

const router = useRouter();
const route = useRoute();

const symbol = ref<string>("");
const interval = ref<KLineInterval>("1d");
const range = ref<KLineRange>("1mo");
const chartType = ref<ChartType>("candlestick" as ChartType);

// 可选的时间周期
const intervals: KLineInterval[] = ["1m", "5m", "15m", "1h", "1d", "1wk", "1mo"];
const ranges: KLineRange[] = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y", "max"];

// 从路由参数获取标的代码
onMounted(() => {
  const routeSymbol = route.params.symbol as string;
  if (routeSymbol) {
    symbol.value = routeSymbol;
  } else {
    // 如果没有 symbol 参数，返回列表页
    router.push("/market");
  }
});

// 获取当前标的的行情数据
const currentQuote = computed(() => {
  return marketState.quotes.find((q) => q.symbol === symbol.value);
});

// 显示名称
const displayName = computed(() => {
  return currentQuote.value?.displayName || symbol.value;
});

// 返回列表页
function goBack() {
  router.push("/market");
}

// 切换图表类型
function toggleChartType() {
  const types: ChartType[] = ["candlestick", "area", "line"];
  const currentIndex = types.indexOf(chartType.value);
  const nextType = types[(currentIndex + 1) % types.length];
  chartType.value = nextType as ChartType;
}

// 获取图表类型显示名称
function getChartTypeLabel(type: ChartType): string {
  const labels: Record<ChartType, string> = {
    candlestick: "蜡烛图",
    area: "面积图",
    line: "折线图",
  };
  return labels[type];
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 顶部工具栏 -->
    <div
      class="flex items-center gap-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-3"
    >
      <button
        class="flex h-7 w-7 items-center justify-center rounded border-none bg-transparent text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] cursor-pointer"
        @click="goBack"
        title="返回"
      >
        ←
      </button>

      <div class="flex flex-1 flex-col">
        <span class="font-medium text-sm">{{ displayName }}</span>
        <span class="text-xs text-[var(--vscode-descriptionForeground)]">{{
          symbol
        }}</span>
      </div>

      <!-- 周期选择 -->
      <select
        v-model="interval"
        class="h-7 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-2 text-xs text-[var(--vscode-input-foreground)]"
        title="时间周期"
      >
        <option v-for="int in intervals" :key="int" :value="int">
          {{ getIntervalLabel(int) }}
        </option>
      </select>

      <!-- 范围选择 -->
      <select
        v-model="range"
        class="h-7 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-2 text-xs text-[var(--vscode-input-foreground)]"
        title="数据范围"
      >
        <option v-for="r in ranges" :key="r" :value="r">
          {{ getRangeLabel(r) }}
        </option>
      </select>

      <!-- 图表类型切换 -->
      <button
        class="flex h-7 items-center justify-center rounded border-none bg-[var(--vscode-button-secondaryBackground)] px-3 text-xs text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] cursor-pointer"
        @click="toggleChartType"
        :title="getChartTypeLabel(chartType)"
      >
        {{ getChartTypeLabel(chartType) }}
      </button>
    </div>

    <!-- K 线图区域 -->
    <div class="flex-1 overflow-hidden p-3">
      <KLineChart
        v-if="symbol"
        :symbol="symbol"
        :interval="interval"
        :range="range"
        :chart-type="chartType || 'candlestick'"
        :height="500"
      />
    </div>

    <!-- 底部信息栏 -->
    <div
      v-if="currentQuote"
      class="border-t border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-3"
    >
      <div class="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div class="flex flex-col">
          <span class="text-xs text-[var(--vscode-descriptionForeground)]"
            >当前价</span
          >
          <span class="font-semibold">{{
            currentQuote.price?.toFixed(2) || "--"
          }}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-[var(--vscode-descriptionForeground)]"
            >涨跌额</span
          >
          <span
            class="font-semibold"
            :class="
              currentQuote.change > 0
                ? 'text-[var(--vscode-charts-green)]'
                : currentQuote.change < 0
                  ? 'text-[var(--vscode-charts-red)]'
                  : ''
            "
          >
            {{ currentQuote.change >= 0 ? "+" : ""
            }}{{ currentQuote.change?.toFixed(2) || "--" }}
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-[var(--vscode-descriptionForeground)]"
            >涨跌幅</span
          >
          <span
            class="font-semibold"
            :class="
              currentQuote.changePercent > 0
                ? 'text-[var(--vscode-charts-green)]'
                : currentQuote.changePercent < 0
                  ? 'text-[var(--vscode-charts-red)]'
                  : ''
            "
          >
            {{ currentQuote.changePercent >= 0 ? "+" : ""
            }}{{ currentQuote.changePercent?.toFixed(2) || "--" }}%
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-[var(--vscode-descriptionForeground)]"
            >更新时间</span
          >
          <span class="text-xs">{{
            currentQuote.timestamp
              ? new Date(currentQuote.timestamp).toLocaleTimeString()
              : "--"
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 响应式网格布局 */
@media (max-width: 640px) {
  .grid-cols-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
