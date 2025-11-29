/**
 * 微博热搜客户端
 * 获取微博实时热搜榜数据
 */

import { httpGet } from "../../../utils/vscode";
import type { HotClient, HotItem, HotSource } from "../types";

// ============ 微博 API 响应类型定义 ============

/** 微博热搜条目 */
interface WeiboHotItem {
  /** 热搜词 */
  word: string;
  /** 说明 */
  note: string;
  /** 热度值 */
  num: number;
  /** 原始热度 */
  raw_hot: number;
  /** 实际排名位置 */
  realpos: number;
  /** 排名 */
  rank: number;
  /** 分类 */
  category: string;
  /** 标签名称 */
  label_name: string;
  /** 透明标签（如：高热讨论、新、沸等） */
  transparency_tag: string;
  /** 上榜时间戳 */
  onboard_time: number;
  /** 是否为广告 */
  flag: number;
}

/** 微博 API 响应 */
interface WeiboApiResponse {
  /** 状态码，1 表示成功 */
  ok: number;
  /** 数据 */
  data: {
    /** 热搜列表 */
    band_list: WeiboHotItem[];
  };
}

// ============ 客户端实现 ============

/** 微博热搜源配置 */
const source: HotSource = {
  id: "weibo",
  name: "微博热搜",
  icon: "🔥",
  homepage: "https://weibo.com/hot/search",
};

/** 微博热搜 API URL */
const API_URL = "https://weibo.com/ajax/statuses/hot_band";

/**
 * 格式化热度值
 * @param num 热度值
 */
function formatHot(num: number): string {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return String(num);
}

/**
 * 解析微博 API 响应
 * @param json API 返回的 JSON 字符串
 * @returns 热点列表
 */
function parseHotList(json: string): HotItem[] {
  const items: HotItem[] = [];

  try {
    const response: WeiboApiResponse = JSON.parse(json);

    if (response.ok !== 1) {
      console.log("[微博热搜] API 返回失败");
      return items;
    }

    const hotList = response.data?.band_list;
    if (!hotList) {
      console.log("[微博热搜] 未找到热搜列表");
      return items;
    }

    // 过滤广告（flag !== 0 通常是广告）
    const filteredList = hotList.filter((item) => item.flag === 0);

    filteredList.forEach((item: WeiboHotItem, index: number) => {
      const hotItem: HotItem = {
        rank: index + 1,
        title: item.word || item.note,
        hot: formatHot(item.num),
        url: `https://s.weibo.com/weibo?q=%23${encodeURIComponent(item.word)}%23`,
        desc: item.category || undefined,
      };

      if (hotItem.title) {
        items.push(hotItem);
      }
    });
  } catch (e) {
    console.error("[微博热搜] 解析 JSON 失败:", e);
  }

  return items;
}

/**
 * 微博热搜客户端
 */
export const weiboClient: HotClient = {
  source,

  async fetchHotList(): Promise<HotItem[]> {
    console.log("[微博热搜] 开始获取数据...");

    const response = await httpGet(API_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Origin": "https://weibo.com",
        "Referer": "https://weibo.com/hot/search",
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "请求失败");
    }

    console.log("[微博热搜] 响应长度:", response.data.length);

    const items = parseHotList(response.data);
    console.log("[微博热搜] 解析到", items.length, "条热搜");

    return items;
  },
};
