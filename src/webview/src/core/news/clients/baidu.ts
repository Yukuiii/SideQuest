/**
 * 百度热搜客户端
 * 获取百度实时热搜榜数据
 */

import { httpGet } from "../../../utils/vscode";
import { getRandomUA } from "../../../utils/userAgent";
import type { HotClient, HotItem, HotSource } from "../types";

// ============ 百度 API 响应类型定义 ============

/** 百度热搜条目 */
interface BaiduHotItem {
  /** 移动端搜索链接 */
  appUrl: string;
  /** 描述/摘要 */
  desc: string;
  /** 热度变化：same/up/down */
  hotChange: string;
  /** 热度值（字符串格式） */
  hotScore: string;
  /** 标签类型：0=无, 1=热, 2=新, 3=沸 */
  hotTag: string;
  /** 标签图片 URL */
  hotTagImg?: string;
  /** 配图 URL */
  img: string;
  /** 排名索引 */
  index: number;
  /** 索引链接 */
  indexUrl: string;
  /** 搜索词 */
  query: string;
  /** 原始链接 */
  rawUrl: string;
  /** 展示信息 */
  show: unknown[];
  /** 搜索链接 */
  url: string;
  /** 热搜词 */
  word: string;
}

/** 百度卡片 */
interface BaiduCard {
  /** 组件类型 */
  component: string;
  /** 热搜列表 */
  content: BaiduHotItem[];
}

/** 百度热搜 API 响应 */
interface BaiduApiResponse {
  /** 请求是否成功 */
  success: boolean;
  /** 数据 */
  data: {
    cards: BaiduCard[];
  };
}

// ============ 客户端实现 ============

/** 百度热搜源配置 */
const source: HotSource = {
  id: "baidu",
  name: "百度热搜",
  icon: "🔍",
  homepage: "https://top.baidu.com",
};

/** 百度热搜 API URL */
const API_URL = "https://top.baidu.com/api/board?platform=wise&tab=realtime";

/** 热度标签映射 */
const HOT_TAG_MAP: Record<string, string> = {
  "1": "热",
  "2": "新",
  "3": "沸",
};

/**
 * 解析百度热搜 API 响应
 * @param json API 返回的 JSON 字符串
 * @returns 热点列表
 */
function parseHotList(json: string): HotItem[] {
  const items: HotItem[] = [];

  try {
    const response: BaiduApiResponse = JSON.parse(json);

    if (!response.success) {
      console.log("[百度热搜] API 返回失败");
      return items;
    }

    const hotList = response.data?.cards?.[0]?.content;
    if (!hotList) {
      console.log("[百度热搜] 未找到热搜列表");
      return items;
    }

    hotList.forEach((item: BaiduHotItem) => {
      const hotItem: HotItem = {
        rank: item.index + 1,
        title: item.word || item.query,
        hot: formatHotScore(item.hotScore),
        url: item.url || item.rawUrl,
        desc: item.desc || undefined,
        image: item.img || undefined,
        tag: HOT_TAG_MAP[item.hotTag],
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
 * @param score 热度值字符串
 */
function formatHotScore(score: string): string {
  const value = parseInt(score, 10);
  if (isNaN(value)) {
    return score;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return String(value);
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
        "User-Agent": getRandomUA(),
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
