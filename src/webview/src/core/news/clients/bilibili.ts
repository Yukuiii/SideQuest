/**
 * B站热榜客户端
 * 获取B站全站排行榜数据
 */

import { httpGet } from "../../../utils/vscode";
import type { HotClient, HotItem, HotSource } from "../types";

// ============ B站 API 响应类型定义 ============

/** UP主信息 */
interface BilibiliOwner {
  /** UP主 ID */
  mid: number;
  /** UP主名称 */
  name: string;
  /** 头像 URL */
  face: string;
}

/** 视频统计数据 */
interface BilibiliStat {
  /** 视频 ID */
  aid: number;
  /** 播放量 */
  view: number;
  /** 弹幕数 */
  danmaku: number;
  /** 评论数 */
  reply: number;
  /** 收藏数 */
  favorite: number;
  /** 投币数 */
  coin: number;
  /** 分享数 */
  share: number;
  /** 点赞数 */
  like: number;
}

/** B站视频条目 */
interface BilibiliVideoItem {
  /** 视频 AV 号 */
  aid: number;
  /** 视频 BV 号 */
  bvid: string;
  /** 标题 */
  title: string;
  /** 封面图 */
  pic: string;
  /** 描述 */
  desc: string;
  /** 时长（秒） */
  duration: number;
  /** 发布时间戳 */
  pubdate: number;
  /** 分区 ID */
  tid: number;
  /** 分区名称 */
  tname: string;
  /** UP主信息 */
  owner: BilibiliOwner;
  /** 统计数据 */
  stat: BilibiliStat;
  /** 短链接 */
  short_link_v2: string;
  /** 动态文字 */
  dynamic: string;
}

/** B站 API 响应 */
interface BilibiliApiResponse {
  /** 状态码，0 表示成功 */
  code: number;
  /** 消息 */
  message: string;
  /** 数据 */
  data: {
    /** 说明 */
    note: string;
    /** 视频列表 */
    list: BilibiliVideoItem[];
  };
}

// ============ 客户端实现 ============

/** B站热榜源配置 */
const source: HotSource = {
  id: "bilibili",
  name: "B站热榜",
  icon: "📺",
  homepage: "https://www.bilibili.com/v/popular/rank/all",
};

/** B站排行榜 API URL */
const API_URL = "https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all";

/**
 * 格式化播放量
 * @param view 播放量
 */
function formatView(view: number): string {
  if (view >= 10000) {
    return `${(view / 10000).toFixed(1)}万播放`;
  }
  return `${view}播放`;
}

/**
 * 解析B站 API 响应
 * @param json API 返回的 JSON 字符串
 * @returns 热点列表
 */
function parseHotList(json: string): HotItem[] {
  const items: HotItem[] = [];

  try {
    const response: BilibiliApiResponse = JSON.parse(json);

    if (response.code !== 0) {
      console.log("[B站热榜] API 返回错误:", response.code, response.message);
      return items;
    }

    const videoList = response.data?.list;
    if (!videoList) {
      console.log("[B站热榜] 未找到视频列表");
      return items;
    }

    videoList.forEach((video: BilibiliVideoItem, index: number) => {
      const hotItem: HotItem = {
        rank: index + 1,
        title: video.title,
        hot: formatView(video.stat.view),
        url: `https://www.bilibili.com/video/${video.bvid}`,
        desc: `${video.owner.name} · ${video.tname}`,
        image: video.pic,
      };

      items.push(hotItem);
    });
  } catch (e) {
    console.error("[B站热榜] 解析 JSON 失败:", e);
  }

  return items;
}

/**
 * B站热榜客户端
 */
export const bilibiliClient: HotClient = {
  source,

  async fetchHotList(): Promise<HotItem[]> {
    console.log("[B站热榜] 开始获取数据...");

    const response = await httpGet(API_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://www.bilibili.com",
        // buvid3: 设备标识，必须有才能通过风控
        "Cookie": "buvid3=99630CF3-F798-91E5-8700-880A87A38F6993388infoc",
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "请求失败");
    }

    console.log("[B站热榜] 响应长度:", response.data.length);

    const items = parseHotList(response.data);
    console.log("[B站热榜] 解析到", items.length, "条视频");

    return items;
  },
};
