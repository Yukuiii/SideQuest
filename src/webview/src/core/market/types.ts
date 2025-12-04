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
