import type { MarketDataSource } from "../types";

export const YAHOO_SOURCE: MarketDataSource = {
  id: "yahoo",
  name: "Yahoo Finance",
  supportedTypes: ["stock", "index"],
  async fetchQuote() {
    throw new Error("fetchQuote not implemented (迭代 2 实现)");
  },
};

export const SINA_SOURCE: MarketDataSource = {
  id: "sina",
  name: "新浪财经",
  supportedTypes: ["stock", "index"],
  async fetchQuote() {
    throw new Error("fetchQuote not implemented (迭代 2 实现)");
  },
};

export const BINANCE_SOURCE: MarketDataSource = {
  id: "binance",
  name: "Binance",
  supportedTypes: ["crypto"],
  async fetchQuote() {
    throw new Error("fetchQuote not implemented (迭代 2 实现)");
  },
};

export const BUILTIN_SOURCES: Record<string, MarketDataSource> = {
  [YAHOO_SOURCE.id]: YAHOO_SOURCE,
  [SINA_SOURCE.id]: SINA_SOURCE,
  [BINANCE_SOURCE.id]: BINANCE_SOURCE,
};

export function getSourceById(id: string): MarketDataSource | undefined {
  return BUILTIN_SOURCES[id];
}
