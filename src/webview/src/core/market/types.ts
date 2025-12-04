export type WatchItemType = "stock" | "crypto" | "index";

export interface WatchItem {
  type: WatchItemType;
  symbol: string;
  displayName?: string;
  sourceId: string;
}

export interface QuoteData {
  symbol: string;
  displayName?: string;
  price: number;
  change: number;
  changePercent: number;
  high?: number;
  low?: number;
  volume?: string;
  timestamp: number;
  sourceId?: string;
}

export interface MarketDataSource {
  id: string;
  name: string;
  supportedTypes: WatchItemType[];
  fetchQuote(symbol: string, type: WatchItemType): Promise<QuoteData>;
  fetchBatchQuotes?(
    symbols: Array<{ symbol: string; type: WatchItemType }>
  ): Promise<QuoteData[]>;
}

export interface WatchlistConfig {
  watchlist: WatchItem[];
}

export interface RefreshConfig {
  refreshInterval: number;
  rotateInterval: number;
  autoRefresh: boolean;
}

export type ColorMode = "default" | "reverse" | "theme";

export interface DisplayConfig {
  colorMode: ColorMode;
  showPercentage: boolean;
  showAbsolute: boolean;
  decimalPlaces: number;
}

// K 线数据类型
export interface KLineData {
  time: number;      // 时间戳 (秒)
  open: number;      // 开盘价
  high: number;      // 最高价
  low: number;       // 最低价
  close: number;     // 收盘价
  volume?: number;   // 成交量
}

export type KLineInterval = "1m" | "5m" | "15m" | "1h" | "1d" | "1wk" | "1mo";
export type KLineRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "5y" | "max";
export type ChartType = "candlestick" | "area" | "line";
