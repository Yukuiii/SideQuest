/**
 * Webview 入口文件
 */
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router from "./router";
import { showToast } from "./utils/toast";
import { setupThemeBridge } from "./core/theme";
import { setupMarketBridge } from "./core/market/marketManager";

// 初始化主题同步（请求初始主题 + 监听更新）
setupThemeBridge();
// 初始化操盘手消息通道
setupMarketBridge();

const app = createApp(App);
app.use(router);
app.mount("#app");

// 全局捕获未处理的 Promise 错误，给出 Toast 提示
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason as { message?: string; code?: string } | string;
  const message =
    typeof reason === "string"
      ? reason
      : reason?.code === "TIMEOUT_ERROR"
        ? "请求超时，请检查网络或重试"
        : reason?.message || "请求失败，请稍后重试";
  showToast(message);
});

// Webview 全局消息：路由导航
window.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;
  if (message.command === "navigate" && message.payload?.route) {
    router.push(message.payload.route);
  }
});
