/**
 * 抖音热搜客户端
 * 获取抖音热搜榜数据
 */

import { httpGet } from "../../../utils/vscode";
import { getRandomUA } from "../../../utils/userAgent";
import type { HotClient, HotItem, HotSource } from "../types";

// ============ 抖音 API 响应类型定义 ============

/** 抖音封面图 */
interface DouyinWordCover {
  /** 图片 URI */
  uri: string;
  /** 图片 URL 列表 */
  url_list: string[];
}

/** 抖音热搜条目 */
interface DouyinHotItem {
  /** 热搜词 */
  word: string;
  /** 热度值 */
  hot_value: number;
  /** 排名位置 */
  position: number;
  /** 封面图 */
  word_cover?: DouyinWordCover;
  /** 标签类型 */
  label: number;
  /** 话题标签 */
  sentence_tag: number;
  /** 相关视频数 */
  video_count: number;
  /** 话题组 ID */
  group_id: string;
  /** 话题 ID */
  sentence_id: string;
}

/** 抖音 API 响应 */
interface DouyinApiResponse {
  /** 状态码，0 表示成功 */
  status_code: number;
  /** 数据 */
  data: {
    /** 热搜词列表 */
    word_list: DouyinHotItem[];
  };
}

// ============ 客户端实现 ============

/** 抖音热搜源配置 */
const source: HotSource = {
  id: "douyin",
  name: "抖音热搜",
  icon: "🎵",
  homepage: "https://www.douyin.com/hot",
};

/** 抖音热搜 API URL */
const API_URL = "https://www-hj.douyin.com/aweme/v1/web/hot/search/list";

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
 * 解析抖音 API 响应
 * @param json API 返回的 JSON 字符串
 * @returns 热点列表
 */
function parseHotList(json: string): HotItem[] {
  const items: HotItem[] = [];

  try {
    const response: DouyinApiResponse = JSON.parse(json);

    if (response.status_code !== 0) {
      console.log("[抖音热搜] API 返回失败:", response.status_code);
      return items;
    }

    const wordList = response.data?.word_list;
    if (!wordList) {
      console.log("[抖音热搜] 未找到热搜列表");
      return items;
    }

    wordList.forEach((item: DouyinHotItem) => {
      const hotItem: HotItem = {
        rank: item.position,
        title: item.word,
        hot: formatHotValue(item.hot_value),
        url: `https://www.douyin.com/search/${encodeURIComponent(item.word)}`,
        image: item.word_cover?.url_list?.[0],
      };

      if (hotItem.title) {
        items.push(hotItem);
      }
    });
  } catch (e) {
    console.error("[抖音热搜] 解析 JSON 失败:", e);
  }

  return items;
}

/**
 * 抖音热搜客户端
 */
export const douyinClient: HotClient = {
  source,

  async fetchHotList(): Promise<HotItem[]> {
    console.log("[抖音热搜] 开始获取数据...");

    const response = await httpGet(API_URL, {
      headers: {
        "User-Agent": getRandomUA(),
        "Referer": "https://www.douyin.com",
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "请求失败");
    }

    console.log("[抖音热搜] 响应长度:", response.data.length);

    const items = parseHotList(response.data);
    console.log("[抖音热搜] 解析到", items.length, "条热搜");

    return items;
  },
};
