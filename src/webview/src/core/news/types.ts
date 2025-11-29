/**
 * 热点新闻类型定义
 */

/**
 * 热点条目
 */
export interface HotItem {
  /** 排名 */
  rank: number;
  /** 标题 */
  title: string;
  /** 热度值（可选） */
  hot?: string;
  /** 链接 */
  url: string;
  /** 摘要/描述（可选） */
  desc?: string;
  /** 图片（可选） */
  image?: string;
  /** 标签（可选，如：新、热、沸） */
  tag?: string;
}

/**
 * 热点源配置
 */
export interface HotSource {
  /** 唯一标识 */
  id: string;
  /** 名称 */
  name: string;
  /** 图标（emoji 或 URL） */
  icon: string;
  /** 来源主页 */
  homepage: string;
}

/**
 * 热点源客户端接口
 * 所有热点源都需要实现此接口
 */
export interface HotClient {
  /** 热点源配置 */
  source: HotSource;
  /** 获取热点列表 */
  fetchHotList(): Promise<HotItem[]>;
}
