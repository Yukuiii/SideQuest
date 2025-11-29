/**
 * 百度热搜客户端
 * 获取百度实时热搜榜数据
 */

import { httpGet } from "../../../utils/vscode";
import type { HotClient, HotItem, HotSource } from "../types";

/** 百度热搜源配置 */
const source: HotSource = {
  id: "baidu",
  name: "百度热搜",
  icon: "🔍",
  homepage: "https://top.baidu.com",
};

/** 百度热搜 API URL */
const API_URL = "https://top.baidu.com/board?tab=realtime";

/**
 * 解析百度热搜页面
 * @param html 页面 HTML 
 * @returns 热点列表
 */
function parseHotList(html: string): HotItem[] {
  const items: HotItem[] = [];

  // 百度热搜数据在 JSON 中，通过正则提取
  // 页面中有 <!--s-data:{"data":{"cards":[...]}}-->
  const dataMatch = html.match(/<!--s-data:(.*?)-->/s);
  if (!dataMatch || !dataMatch[1]) {
    console.log("[百度热搜] 未找到数据块");
    return items;
  }

  try {
    const jsonData = JSON.parse(dataMatch[1]);
    const cards = jsonData?.data?.cards;

    if (!Array.isArray(cards) || cards.length === 0) {
      console.log("[百度热搜] 未找到 cards 数据");
      return items;
    }

    // 第一个 card 通常是热搜榜
    const hotList = cards[0]?.content;
    if (!Array.isArray(hotList)) {
      console.log("[百度热搜] 未找到热搜列表");
      return items;
    }

    hotList.forEach((item: Record<string, unknown>, index: number) => {
      const hotItem: HotItem = {
        rank: index + 1,
        title: String(item.word || item.query || ""),
        hot: formatHotValue(item.hotScore),
        url: String(item.url || `https://www.baidu.com/s?wd=${encodeURIComponent(String(item.word || ""))}`),
        desc: String(item.desc || ""),
        image: item.img ? String(item.img) : undefined,
        tag: parseTag(item.label),
      };

      if (hotItem.title) {
        items.push(hotItem);
      }
    });
  } catch (e) {
    console.error("[百度热搜] 解析 JSON 失败:", e);
  }

  return items;
}

/**
 * 格式化热度值
 */
function formatHotValue(value: unknown): string {
  if (typeof value === "number") {
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}万`;
    }
    return String(value);
  }
  return String(value || "");
}

/**
 * 解析标签
 */
function parseTag(label: unknown): string | undefined {
  if (!label) {
    return undefined;
  }
  if (typeof label === "string") {
    return label;
  }
  if (typeof label === "object" && label !== null) {
    const labelObj = label as Record<string, unknown>;
    return String(labelObj.name || labelObj.text || "");
  }
  return undefined;
}

/**
 * 百度热搜客户端
 */
export const baiduClient: HotClient = {
  source,

  async fetchHotList(): Promise<HotItem[]> {
    console.log("[百度热搜] 开始获取数据...");

    const response = await httpGet(API_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "请求失败");
    }

    console.log("[百度热搜] 响应长度:", response.data.length);

    const items = parseHotList(response.data);
    console.log("[百度热搜] 解析到", items.length, "条热搜");

    return items;
  },
};
