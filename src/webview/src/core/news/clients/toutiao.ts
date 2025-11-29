/**
 * 今日头条热搜客户端
 * 获取头条热榜数据
 */

import { httpGet } from "../../../utils/vscode";
import { getRandomUA } from "../../../utils/userAgent";
import type { HotClient, HotItem, HotSource } from "../types";

// ============ 头条 API 响应类型定义 ============

/** 头条图片 */
interface ToutiaoImage {
  /** 图片 URI */
  uri: string;
  /** 图片 URL */
  url: string;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
}

/** 头条热搜条目 */
interface ToutiaoHotItem {
  /** 话题 ID */
  ClusterId: number;
  /** 话题 ID 字符串 */
  ClusterIdStr: string;
  /** 标题 */
  Title: string;
  /** 搜索词 */
  QueryWord: string;
  /** 热度值 */
  HotValue: string;
  /** 链接 */
  Url: string;
  /** 标签 */
  Label: string;
  /** 封面图 */
  Image?: ToutiaoImage;
}

/** 头条 API 响应 */
interface ToutiaoApiResponse {
  /** 状态 */
  status: string;
  /** 消息 */
  message: string | null;
  /** 热搜列表 */
  data: ToutiaoHotItem[];
}

// ============ 客户端实现 ============

/** 头条热搜源配置 */
const source: HotSource = {
  id: "toutiao",
  name: "头条热榜",
  icon: "📰",
  homepage: "https://www.toutiao.com",
};

/** 头条热搜 API URL */
const API_URL = "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc";

/**
 * 格式化热度值
 * @param value 热度值字符串
 */
function formatHotValue(value: string): string {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return value;
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return String(num);
}

/**
 * 解析头条 API 响应
 * @param json API 返回的 JSON 字符串
 * @returns 热点列表
 */
function parseHotList(json: string): HotItem[] {
  const items: HotItem[] = [];

  try {
    const response: ToutiaoApiResponse = JSON.parse(json);

    if (response.status !== "success") {
      console.log("[头条热榜] API 返回失败:", response.status);
      return items;
    }

    const hotList = response.data;
    if (!hotList) {
      console.log("[头条热榜] 未找到热搜列表");
      return items;
    }

    hotList.forEach((item: ToutiaoHotItem, index: number) => {
      const hotItem: HotItem = {
        rank: index + 1,
        title: item.Title,
        hot: formatHotValue(item.HotValue),
        url: item.Url,
        image: item.Image?.url,
        tag: item.Label || undefined,
      };

      if (hotItem.title) {
        items.push(hotItem);
      }
    });
  } catch (e) {
    console.error("[头条热榜] 解析 JSON 失败:", e);
  }

  return items;
}

/**
 * 头条热搜客户端
 */
export const toutiaoClient: HotClient = {
  source,

  async fetchHotList(): Promise<HotItem[]> {
    console.log("[头条热榜] 开始获取数据...");

    const response = await httpGet(API_URL, {
      headers: {
        "User-Agent": getRandomUA(),
        "Referer": "https://www.toutiao.com",
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "请求失败");
    }

    console.log("[头条热榜] 响应长度:", response.data.length);

    const items = parseHotList(response.data);
    console.log("[头条热榜] 解析到", items.length, "条热搜");

    return items;
  },
};
