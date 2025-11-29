/**
 * 热点新闻模块导出
 */

// 类型导出
export type { HotItem, HotSource, HotClient } from "./types";

// 客户端导出
export { baiduClient, bilibiliClient, weiboClient, douyinClient } from "./clients";

// 导入所有客户端用于注册
import { baiduClient, bilibiliClient, weiboClient, douyinClient } from "./clients";
import type { HotClient } from "./types";

/**
 * 所有可用的热点源客户端
 */
export const hotClients: HotClient[] = [
  baiduClient,
  bilibiliClient,
  weiboClient,
  douyinClient,
];

/**
 * 根据 ID 获取热点源客户端
 * @param id 热点源 ID
 */
export function getHotClient(id: string): HotClient | undefined {
  return hotClients.find((client) => client.source.id === id);
}
