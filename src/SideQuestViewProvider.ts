import * as vscode from 'vscode';
import { logger } from './utils/logger';
import { httpService, type HttpRequestOptions } from './services/httpService';

/**
 * Side Quest 侧边栏 Webview 视图提供者
 * 负责创建和管理侧边栏中的 Webview 视图
 */
export class SideQuestViewProvider implements vscode.WebviewViewProvider {
  /** 视图类型标识符，与 package.json 中的配置对应 */
  public static readonly viewType = 'side-quest.mainView';

  /**
   * 构造函数
   * @param _extensionUri - 扩展的根目录 URI，用于加载本地资源
   */
  constructor(private readonly _extensionUri: vscode.Uri) {}

  /**
   * 解析 Webview 视图
   * 当视图首次显示时由 VS Code 调用
   * @param webviewView - Webview 视图实例
   * @param _context - 视图解析上下文
   * @param _token - 取消令牌
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    // 配置 Webview 选项
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview'),
      ],
    };

    // 设置 Webview HTML 内容
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // 处理来自 Webview 的消息
    webviewView.webview.onDidReceiveMessage(async (message) => {
      logger.debug('Received message from webview', message);
      const { command, requestId, data } = message;

      switch (command) {
        case 'selectMode':
          vscode.window.showInformationMessage(`功能开发中：${data.mode}`);
          break;

        case 'httpRequest':
          // 代理 HTTP 请求
          await this._handleHttpRequest(webviewView.webview, requestId, data);
          break;

        case 'openUrl':
          // 使用 Simple Browser 在编辑器内打开链接
          await this._openUrlInSimpleBrowser(data.url);
          break;
      }
    });
  }

  /**
   * 使用 Simple Browser 在编辑器内打开 URL
   * @param url 要打开的 URL
   */
  private async _openUrlInSimpleBrowser(url: string): Promise<void> {
    try {
      await vscode.commands.executeCommand('simpleBrowser.show', url);
    } catch (error) {
      logger.error('Failed to open Simple Browser:', error);
      // 如果 Simple Browser 不可用，回退到外部浏览器
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }
  }

  /**
   * 处理 HTTP 请求代理
   * @param webview Webview 实例
   * @param requestId 请求 ID（用于回调匹配）
   * @param options HTTP 请求选项
   */
  private async _handleHttpRequest(
    webview: vscode.Webview,
    requestId: string,
    options: HttpRequestOptions
  ): Promise<void> {
    try {
      logger.debug(`Proxy HTTP request: ${options.method || 'GET'} ${options.url}`);

      const response = await httpService.get(options.url, {
        headers: options.headers,
        charset: options.charset,
        timeout: options.timeout,
      });

      // 如果是 POST 请求
      if (options.method === 'POST') {
        const postResponse = await httpService.post(options.url, options.body, {
          headers: options.headers,
          charset: options.charset,
          timeout: options.timeout,
        });
        webview.postMessage({
          command: 'httpResponse',
          requestId,
          response: postResponse,
        });
        return;
      }

      webview.postMessage({
        command: 'httpResponse',
        requestId,
        response,
      });
    } catch (error) {
      logger.error('HTTP proxy error:', error);
      webview.postMessage({
        command: 'httpResponse',
        requestId,
        response: {
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        },
      });
    }
  }

  /**
   * 生成 Webview 的 HTML 内容
   * 加载 Vue 构建产物并设置 CSP 安全策略
   * @param webview - Webview 实例
   * @returns HTML 字符串
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distUri = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'assets', 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'assets', 'index.css'));
    const nonce = this._getNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; img-src https: http: data:;">
  <title>Side Quest</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * 生成随机 Nonce 值
   * 用于 CSP 脚本安全策略
   * @returns 32 位随机字符串
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
