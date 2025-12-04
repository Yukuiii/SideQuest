import type { MarketDataSource } from "../types";

export const YAHOO_SOURCE: MarketDataSource = {
  id: "yahoo",
  name: "Yahoo Finance",
  supportedTypes: ["stock", "index"],
  async fetchQuote() {
    // 数据拉取在扩展端完成，这里仅保留接口定义
    throw new Error("数据拉取由扩展端处理");
  },
};

export const BUILTIN_SOURCES: Record<string, MarketDataSource> = {
  [YAHOO_SOURCE.id]: YAHOO_SOURCE,
};

export function getSourceById(id: string): MarketDataSource | undefined {
  return BUILTIN_SOURCES[id];
}
