/**
 * 百度贴吧热议客户端
 * 获取贴吧热议话题榜数据
 */

import { httpGet } from "../../../utils/vscode";
import { getRandomUA } from "../../../utils/userAgent";
import type { HotClient, HotItem, HotSource } from "../types";

// ============ 贴吧 API 响应类型定义 ============

/** 贴吧热议话题条目 */
interface TiebaTopicItem {
  /** 话题 ID */
  topic_id: number;
  /** 话题名称 */
  topic_name: string;
  /** 话题描述 */
  topic_desc: string;
  /** 话题图片 */
  topic_pic: string;
  /** 标签类型：1=热, 2=新 */
  tag: number;
  /** 讨论数 */
  discuss_num: number;
  /** 排名索引 */
  idx_num: number;
  /** 话题链接 */
  topic_url: string;
}

/** 贴吧热议话题模块 */
interface TiebaBangTopic {
  /** 模块标题 */
  module_title: string;
  /** 话题列表 */
  topic_list: TiebaTopicItem[];
}

/** 贴吧热议 API 响应 */
interface TiebaApiResponse {
  /** 数据 */
  data: {
    /** 热议话题 */
    bang_topic: TiebaBangTopic;
  };
}

// ============ 客户端实现 ============

/** 贴吧热议源配置 */
const source: HotSource = {
  id: "tieba",
  name: "贴吧热议",
  icon: "💬",
  homepage: "https://tieba.baidu.com",
};

/** 贴吧热议 API URL */
const API_URL = "https://tieba.baidu.com/hottopic/browse/topicList";

/** 热度标签映射 */
const HOT_TAG_MAP: Record<number, string> = {
  1: "热",
  2: "新",
};

/**
 * 解析贴吧热议 API 响应
 * @param json API 返回的 JSON 字符串
 * @returns 热点列表
 */
function parseHotList(json: string): HotItem[] {
  const items: HotItem[] = [];

  try {
    const response: TiebaApiResponse = JSON.parse(json);

    const topicList = response.data?.bang_topic?.topic_list;
    if (!topicList) {
      console.log("[贴吧热议] 未找到话题列表");
      return items;
    }

    topicList.forEach((item: TiebaTopicItem) => {
      // 解码 HTML 实体 (&amp; -> &)
      const url = item.topic_url?.replace(/&amp;/g, "&");

      const hotItem: HotItem = {
        rank: item.idx_num,
        title: item.topic_name,
        hot: formatDiscussNum(item.discuss_num),
        url: url || `https://tieba.baidu.com/hottopic/browse/hottopic?topic_id=${item.topic_id}`,
        desc: item.topic_desc || undefined,
        image: item.topic_pic || undefined,
        tag: HOT_TAG_MAP[item.tag],
      };

      if (hotItem.title) {
        items.push(hotItem);
      }
    });
  } catch (e) {
    console.error("[贴吧热议] 解析 JSON 失败:", e);
  }

  return items;
}

/**
 * 格式化讨论数
 * @param num 讨论数
 */
function formatDiscussNum(num: number): string {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return String(num);
}

/**
 * 贴吧热议客户端
 */
export const tiebaClient: HotClient = {
  source,

  async fetchHotList(): Promise<HotItem[]> {
    console.log("[贴吧热议] 开始获取数据...");

    const response = await httpGet(API_URL, {
      headers: {
        "User-Agent": getRandomUA(),
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "请求失败");
    }

    console.log("[贴吧热议] 响应长度:", response.data.length);

    const items = parseHotList(response.data);
    console.log("[贴吧热议] 解析到", items.length, "条热议");

    return items;
  },
};
