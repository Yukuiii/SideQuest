/**
 * VS Code Webview API 封装
 * 提供 Webview 与扩展之间的通信功能
 */

/** 获取 VS Code API 实例 */
const vscode = acquireVsCodeApi();

/** 请求回调映射表 */
const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}>();

/** 请求 ID 计数器 */
let requestIdCounter = 0;

/**
 * 生成唯一请求 ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${++requestIdCounter}`;
}

// 监听来自扩展的消息
window.addEventListener("message", (event) => {
  const message = event.data;

  // 处理 HTTP 响应
  if (message.command === "httpResponse" && message.requestId) {
    const pending = pendingRequests.get(message.requestId);
    if (pending) {
      pendingRequests.delete(message.requestId);
      pending.resolve(message.response);
    }
  }
});

/**
 * 向扩展发送消息
 * @param command - 命令名称
 * @param data - 附加数据（可选）
 */
export function postMessage(command: string, data?: unknown) {
  vscode.postMessage({ command, data });
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
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();

    // 设置超时
    const timeout = options.timeout || 30000;
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`请求超时 (${timeout}ms)`));
    }, timeout + 5000); // 额外 5 秒等待响应

    // 注册回调
    pendingRequests.set(requestId, {
      resolve: (response) => {
        clearTimeout(timer);
        resolve(response as HttpResponse);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });

    // 发送请求
    vscode.postMessage({
      command: "httpRequest",
      requestId,
      data: options,
    });
  });
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
