import type { KLineData, KLineInterval, KLineRange } from "./types";
import { httpRequest } from "../../utils/vscode";

/**
 * K 线数据服务
 * 从 Yahoo Finance API 获取 K 线数据
 */

/**
 * 获取 K 线数据
 * @param symbol 标的代码
 * @param interval 时间周期
 * @param range 数据范围
 * @returns K 线数据数组
 */
export async function fetchKLineData(
  symbol: string,
  interval: KLineInterval = "1d",
  range: KLineRange = "1mo"
): Promise<KLineData[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=${interval}&range=${range}`;

    console.log("[KLine] Fetching data:", { symbol, interval, range, url });

    const response = await httpRequest({
      url,
      method: "GET",
    });

    if (!response.success || !response.data) {
      console.error("[KLine] Request failed:", response.error);
      throw new Error(response.error || "获取 K 线数据失败");
    }

    const json =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    const result = json?.chart?.result?.[0];
    if (!result) {
      console.error("[KLine] No result data");
      throw new Error("无 K 线数据");
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];

    if (!quote) {
      console.error("[KLine] No quote data");
      throw new Error("无报价数据");
    }

    const { open, high, low, close, volume } = quote;

    // 转换为 K 线数据格式
    const klineData: KLineData[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = open?.[i];
      const h = high?.[i];
      const l = low?.[i];
      const c = close?.[i];
      const v = volume?.[i];

      // 跳过无效数据
      if (
        o === null ||
        o === undefined ||
        h === null ||
        h === undefined ||
        l === null ||
        l === undefined ||
        c === null ||
        c === undefined
      ) {
        continue;
      }

      klineData.push({
        time: timestamps[i],
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v !== null && v !== undefined ? v : undefined,
      });
    }

    console.log("[KLine] Data fetched:", {
      symbol,
      count: klineData.length,
      first: klineData[0],
      last: klineData[klineData.length - 1],
    });

    return klineData;
  } catch (error) {
    console.error("[KLine] Fetch error:", error);
    throw error;
  }
}

/**
 * 获取周期显示名称
 */
export function getIntervalLabel(interval: KLineInterval): string {
  const labels: Record<KLineInterval, string> = {
    "1m": "1分钟",
    "5m": "5分钟",
    "15m": "15分钟",
    "1h": "1小时",
    "1d": "日线",
    "1wk": "周线",
    "1mo": "月线",
  };
  return labels[interval] || interval;
}

/**
 * 获取范围显示名称
 */
export function getRangeLabel(range: KLineRange): string {
  const labels: Record<KLineRange, string> = {
    "1d": "1天",
    "5d": "5天",
    "1mo": "1个月",
    "3mo": "3个月",
    "6mo": "6个月",
    "1y": "1年",
    "5y": "5年",
    max: "全部",
  };
  return labels[range] || range;
}
