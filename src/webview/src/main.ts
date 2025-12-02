/**
 * Webview 入口文件
 */
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router from "./router";
import { showToast } from "./utils/toast";

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
