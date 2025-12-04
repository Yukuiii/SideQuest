/**
 * Vue Router 路由配置
 * 使用 createMemoryHistory 以适配 VS Code webview 环境
 */

import { createRouter, createMemoryHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

/** 路由配置 */
const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: () => import("../views/HomeView.vue"),
    meta: { title: "Side Quest" },
  },
  {
    path: "/novel",
    name: "Novel",
    component: () => import("../views/NovelView.vue"),
    meta: { title: "阅读者" },
  },
  {
    path: "/news",
    name: "News",
    component: () => import("../views/NewsView.vue"),
    meta: { title: "情报员" },
  },
  {
    path: "/market",
    name: "Market",
    component: () => import("../views/MarketView.vue"),
    meta: { title: "操盘手" },
  },
  {
    path: "/market/detail/:symbol",
    name: "MarketDetail",
    component: () => import("../views/MarketDetailView.vue"),
    meta: { title: "K 线详情" },
  },
];

/**
 * 创建路由实例
 * 注意：webview 中使用 memory history，不依赖浏览器 URL
 */
const router = createRouter({
  history: createMemoryHistory(),
  routes,
});

export default router;
