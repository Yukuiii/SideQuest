<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
} from "lightweight-charts";
import type { KLineInterval, KLineRange, ChartType } from "../core/market/types";
import { fetchKLineData } from "../core/market/klineService";

const props = withDefaults(
  defineProps<{
    symbol: string;
    interval?: KLineInterval;
    range?: KLineRange;
    chartType?: ChartType;
    height?: number;
  }>(),
  {
    interval: "1d",
    range: "1mo",
    chartType: "candlestick",
    height: 400,
  }
);

const chartContainer = ref<HTMLDivElement>();
const loading = ref(false);
const error = ref<string | null>(null);

let chart: IChartApi | null = null;
let series: ISeriesApi<any> | null = null;

// 初始化图表
function initChart() {
  if (!chartContainer.value || chart) return;

  chart = createChart(chartContainer.value, {
    width: chartContainer.value.clientWidth,
    height: props.height,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "var(--vscode-foreground)",
    },
    grid: {
      vertLines: { color: "var(--vscode-panel-border)" },
      horzLines: { color: "var(--vscode-panel-border)" },
    },
    crosshair: {
      mode: 1, // Normal crosshair
    },
    timeScale: {
      borderColor: "var(--vscode-panel-border)",
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: "var(--vscode-panel-border)",
    },
  });

  // 响应式调整大小
  const resizeObserver = new ResizeObserver((entries) => {
    if (entries.length === 0 || !chart) return;
    const entry = entries[0];
    if (entry && entry.contentRect) {
      const { width } = entry.contentRect;
      chart.applyOptions({ width });
    }
  });

  if (chartContainer.value) {
    resizeObserver.observe(chartContainer.value);
  }

  // 保存 observer 以便清理
  (chart as any)._resizeObserver = resizeObserver;
}

// 创建系列
function createSeries() {
  if (!chart) return;

  // 移除旧系列
  if (series) {
    chart.removeSeries(series);
    series = null;
  }

  // 根据图表类型创建新系列
  switch (props.chartType) {
    case "candlestick":
      series = chart.addSeries(CandlestickSeries, {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderUpColor: "#26a69a",
        borderDownColor: "#ef5350",
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      });
      break;
    case "area":
      series = chart.addSeries(AreaSeries, {
        lineColor: "#2962FF",
        topColor: "#2962FF",
        bottomColor: "rgba(41, 98, 255, 0.28)",
      });
      break;
    case "line":
      series = chart.addSeries(LineSeries, {
        color: "#2962FF",
        lineWidth: 2,
      });
      break;
  }
}

// 加载数据
async function loadData() {
  if (!chart) return;

  loading.value = true;
  error.value = null;

  try {
    const data = await fetchKLineData(props.symbol, props.interval, props.range);

    if (data.length === 0) {
      error.value = "暂无数据";
      return;
    }

    // 创建系列
    createSeries();

    if (!series) return;

    // 根据图表类型转换数据
    if (props.chartType === "candlestick") {
      series.setData(data);
    } else {
      // area 和 line 只需要 time 和 value
      const lineData = data.map((d) => ({
        time: d.time,
        value: d.close,
      }));
      series.setData(lineData);
    }

    // 自动缩放到合适的视图
    chart.timeScale().fitContent();
  } catch (err) {
    console.error("[KLineChart] Load data error:", err);
    error.value = err instanceof Error ? err.message : "加载数据失败";
  } finally {
    loading.value = false;
  }
}

// 监听属性变化
watch(
  () => [props.symbol, props.interval, props.range, props.chartType],
  () => {
    loadData();
  }
);

onMounted(async () => {
  await nextTick();
  initChart();
  loadData();
});

onUnmounted(() => {
  if (chart) {
    const resizeObserver = (chart as any)._resizeObserver;
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    chart.remove();
    chart = null;
  }
  series = null;
});
</script>

<template>
  <div class="kline-chart-wrapper">
    <div
      ref="chartContainer"
      class="kline-chart"
      :style="{ height: `${height}px` }"
    ></div>

    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-[var(--vscode-editor-background)]/80"
    >
      <div class="flex flex-col items-center gap-2">
        <div
          class="h-8 w-8 animate-spin rounded-full border-4 border-[var(--vscode-progressBar-background)] border-t-transparent"
        ></div>
        <div class="text-sm text-[var(--vscode-foreground)]">加载中...</div>
      </div>
    </div>

    <!-- 错误状态 -->
    <div
      v-if="error && !loading"
      class="absolute inset-0 flex items-center justify-center bg-[var(--vscode-editor-background)]/80"
    >
      <div class="text-sm text-[var(--vscode-errorForeground)]">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.kline-chart-wrapper {
  position: relative;
  width: 100%;
}

.kline-chart {
  width: 100%;
}
</style>
