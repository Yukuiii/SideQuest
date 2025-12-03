import { reactive } from "vue";
import type { QuoteData, WatchItem } from "./types";
import { postMessage } from "../../utils/vscode";

export interface MarketState {
  quotes: QuoteData[];
  lastUpdate: number | null;
}

export const marketState = reactive<MarketState>({
  quotes: [],
  lastUpdate: null,
});

export function requestRefresh() {
  postMessage("market.refresh");
}

export function addWatch(item: WatchItem) {
  postMessage("market.addWatch", item);
}

export function setupMarketBridge() {
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    if (message.command === "market.update") {
      marketState.quotes = message.payload?.quotes || [];
      marketState.lastUpdate = message.payload?.lastUpdate ?? null;
    }
  });
}
