/**
 * 网易热点客户端
 * 获取网易新闻热榜数据
 */

import { httpGet } from "../../../utils/vscode";
import { getRandomUA } from "../../../utils/userAgent";
import type { HotClient, HotItem, HotSource } from "../types";

// ============ 网易 API 响应类型定义 ============

/** 网易热点条目 */
interface NeteaseHotItem {
  /** 内容类型 */
  type: string;
  /** 内容 ID */
  contentId: string;
  /** 标题 */
  title: string;
  /** 热度值 */
  hotValue: number;
  /** 来源 */
  source: string;
  /** 封面图 */
  img: string;
  /** 评论数 */
  commentCount: number;
  /** 发布时间 */
  ptime: string;
  /** 分类 */
  category: string;
}

/** 网易 API 响应 */
interface NeteaseApiResponse {
  /** 状态码，0 表示成功 */
  code: number;
  /** 消息 */
  message: string;
  /** 数据 */
  data: {
    /** 热点列表 */
    items: NeteaseHotItem[];
  };
}

// ============ 客户端实现 ============

/** 网易热点源配置 */
const source: HotSource = {
  id: "netease",
  name: "网易热点",
  icon: "📮",
  homepage: "https://www.163.com",
};

/** 网易热点 API URL */
const API_URL = "https://gw.m.163.com/nc-main/api/v1/hqc/no-repeat-hot-list?source=hotTag";

/**
 * 格式化热度值
 * @param value 热度值
 */
function formatHotValue(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return String(value);
}

/**
 * 解析网易 API 响应
 * @param json API 返回的 JSON 字符串
 * @returns 热点列表
 */
function parseHotList(json: string): HotItem[] {
  const items: HotItem[] = [];

  try {
    const response: NeteaseApiResponse = JSON.parse(json);

    if (response.code !== 0) {
      console.log("[网易热点] API 返回失败:", response.code);
      return items;
    }

    const hotList = response.data?.items;
    if (!hotList) {
      console.log("[网易热点] 未找到热点列表");
      return items;
    }

    hotList.forEach((item: NeteaseHotItem, index: number) => {
      const hotItem: HotItem = {
        rank: index + 1,
        title: item.title,
        hot: formatHotValue(item.hotValue),
        url: `https://www.163.com/dy/article/${item.contentId}.html`,
        desc: item.source || undefined,
        image: item.img || undefined,
      };

      if (hotItem.title) {
        items.push(hotItem);
      }
    });
  } catch (e) {
    console.error("[网易热点] 解析 JSON 失败:", e);
  }

  return items;
}

/**
 * 网易热点客户端
 */
export const neteaseClient: HotClient = {
  source,

  async fetchHotList(): Promise<HotItem[]> {
    console.log("[网易热点] 开始获取数据...");

    const response = await httpGet(API_URL, {
      headers: {
        "User-Agent": getRandomUA(),
        "Referer": "https://www.163.com",
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "请求失败");
    }

    console.log("[网易热点] 响应长度:", response.data.length);

    const items = parseHotList(response.data);
    console.log("[网易热点] 解析到", items.length, "条热点");

    return items;
  },
};
