import * as vscode from 'vscode';
import { logger } from './utils/logger';

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
    webviewView.webview.onDidReceiveMessage((message) => {
      logger.debug('Received message from webview', message);
      switch (message.command) {
        case 'selectMode':
          vscode.window.showInformationMessage(`功能开发中：${message.data.mode}`);
          break;
      }
    });
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
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
