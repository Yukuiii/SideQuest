/**
 * VS Code Webview API 封装
 * 提供 Webview 与扩展之间的通信功能
 */

/** 获取 VS Code API 实例 */
const vscode = acquireVsCodeApi();

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

export { vscode };
