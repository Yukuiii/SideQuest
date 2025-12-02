/**
 * VS Code Webview API 封装
 * 提供 Webview 与扩展之间的通信功能
 */

/** 获取 VS Code API 实例 */
const vscode = acquireVsCodeApi();

/** 标准响应结构 */
interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { message: string; code?: string };
}

/** 请求回调映射表 */
const pendingRequests = new Map<
  string,
  {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timer: number;
  }
>();

/** 请求 ID 计数器 */
let requestIdCounter = 0;

/**
 * 生成唯一请求 ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${++requestIdCounter}`;
}

// 监听来自扩展的消息（统一响应）
window.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.command !== "response" || !message.requestId) return;

  const pending = pendingRequests.get(message.requestId);
  if (!pending) return;

  pendingRequests.delete(message.requestId);
  clearTimeout(pending.timer);

  const payload = message.payload as ExtensionResponse;
  if (payload?.success) {
    pending.resolve(payload.data as unknown);
  } else {
    pending.reject(
      payload?.error ?? { message: "未知错误", code: "UNKNOWN_ERROR" }
    );
  }
});

/**
 * 向扩展发送消息（无需响应）
 * @param command - 命令名称
 * @param data - 附加数据（可选）
 */
export function postMessage(command: string, data?: unknown) {
  vscode.postMessage({ command, data });
}

/**
 * 统一的请求方法，带超时和标准错误对象
 */
export function requestExtension<T = unknown>(
  command: string,
  payload: unknown,
  timeout = 15000
): Promise<T> {
  const requestId = generateRequestId();

  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingRequests.delete(requestId);
      reject({ message: "请求超时，请检查网络或重试", code: "TIMEOUT_ERROR" });
    }, timeout);

    pendingRequests.set(requestId, { resolve, reject, timer });

    vscode.postMessage({ command, requestId, payload });
  });
}

/**
 * 获取 Webview 持久化状态
 * @returns 存储的状态对象，如果不存在则返回 undefined
 */
export function getState<T>(): T | undefined {
  return vscode.getState() as T | undefined;
}

/**
 * 设置 Webview 持久化状态
 * 状态会在 Webview 隐藏后保留
 * @param state - 要保存的状态对象
 */
export function setState<T>(state: T): void {
  vscode.setState(state);
}

/** HTTP 请求选项 */
export interface HttpRequestOptions {
  /** 请求 URL */
  url: string;
  /** 请求方法 */
  method?: "GET" | "POST";
  /** 请求头 */
  headers?: Record<string, string>;
  /** POST 请求体 */
  body?: string;
  /** 字符编码 */
  charset?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/** HTTP 响应结果 */
export interface HttpResponse {
  /** 是否成功 */
  success: boolean;
  /** 状态码 */
  statusCode?: number;
  /** 响应头 */
  headers?: Record<string, string | string[] | undefined>;
  /** 响应内容 */
  data?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 发起 HTTP 请求（通过扩展代理）
 * @param options 请求选项
 * @returns 响应结果
 */
export function httpRequest(options: HttpRequestOptions): Promise<HttpResponse> {
  const timeout = options.timeout || 30000;
  return requestExtension<HttpResponse>("httpRequest", options, timeout);
}

/**
 * 发起 GET 请求
 * @param url 请求 URL
 * @param options 额外选项
 */
export function httpGet(
  url: string,
  options?: Omit<HttpRequestOptions, "url" | "method">
): Promise<HttpResponse> {
  return httpRequest({ ...options, url, method: "GET" });
}

/**
 * 发起 POST 请求
 * @param url 请求 URL
 * @param body 请求体
 * @param options 额外选项
 */
export function httpPost(
  url: string,
  body?: string,
  options?: Omit<HttpRequestOptions, "url" | "method" | "body">
): Promise<HttpResponse> {
  return httpRequest({ ...options, url, method: "POST", body });
}

export { vscode };
