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
  /** 当前 Webview 视图实例 */
  private _view?: vscode.WebviewView;
  /** 主题变化监听句柄 */
  private _themeChangeListener?: vscode.Disposable;
  /** 配置变化监听句柄 */
  private _configurationListener?: vscode.Disposable;
  /** 待导航路由（视图未就绪时缓存） */
  private _pendingRoute?: string;

  /**
   * 构造函数
   * @param _extensionUri - 扩展的根目录 URI，用于加载本地资源
   */
  constructor(private readonly _extensionUri: vscode.Uri, private readonly _context?: vscode.ExtensionContext) {}

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
    this._view = webviewView;

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
      const { command, requestId } = message;
      const payload = message.payload ?? message.data;

      switch (command) {
        case 'selectMode':
          vscode.window.showInformationMessage(`功能开发中：${payload.mode}`);
          break;

        case 'market.refresh':
          this._postMarketUpdate();
          break;

        case 'market.addWatch':
          logger.info('Receive watch add request', payload);
          this._postMarketUpdate();
          break;

        case 'requestTheme':
          this._postThemeUpdate();
          break;

        case 'httpRequest':
          // 代理 HTTP 请求
          await this._handleHttpRequest(webviewView.webview, requestId, payload);
          break;

        case 'openUrl':
          // 使用 Simple Browser 在编辑器内打开链接
          await this._openUrlInSimpleBrowser(payload.url);
          break;
      }
    });

    this._postInitMessage();

    this._themeChangeListener?.dispose();
    this._themeChangeListener = vscode.window.onDidChangeActiveColorTheme((colorTheme) => {
      logger.debug('Active color theme changed', colorTheme.kind);
      this._postThemeUpdate(colorTheme);
    });

    this._configurationListener?.dispose();
    this._configurationListener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('side-quest.reader.lockTheme')) {
        logger.debug('Lock theme configuration changed');
        this._postThemeUpdate();
      }
    });

    webviewView.onDidDispose(() => {
      this._themeChangeListener?.dispose();
      this._configurationListener?.dispose();
      this._themeChangeListener = undefined;
      this._configurationListener = undefined;
      this._view = undefined;
    });

    if (this._pendingRoute) {
      this.navigateTo(this._pendingRoute);
      this._pendingRoute = undefined;
    }
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
    if (!requestId) {
      logger.warn('Missing requestId for httpRequest');
      return;
    }

    if (!options || !options.url) {
      webview.postMessage({
        command: 'response',
        requestId,
        payload: {
          success: false,
          error: {
            message: '无效的请求参数',
            code: 'BAD_REQUEST',
          },
        },
      });
      return;
    }

    try {
      const method = (options.method || 'GET').toUpperCase();
      logger.debug(`Proxy HTTP request: ${method} ${options.url}`);

      const response =
        method === 'POST'
          ? await httpService.post(options.url, options.body, {
              headers: options.headers,
              charset: options.charset,
              timeout: options.timeout,
            })
          : await httpService.get(options.url, {
              headers: options.headers,
              charset: options.charset,
              timeout: options.timeout,
            });

      webview.postMessage({
        command: 'response',
        requestId,
        payload: {
          success: true,
          data: response,
        },
      });
    } catch (error) {
      logger.error('HTTP proxy error:', error);
      webview.postMessage({
        command: 'response',
        requestId,
        payload: {
          success: false,
          error: {
            message: error instanceof Error ? error.message : '未知错误',
            code: 'HTTP_PROXY_ERROR',
          },
        },
      });
    }
  }

  /**
   * 发送初始化消息，包含主题与偏好
   */
  private _postInitMessage(): void {
    if (!this._view) {
      return;
    }

    this._view.webview.postMessage({
      command: 'init',
      payload: {
        theme: this._getThemeInfo(),
        prefs: this._getReaderPreferences(),
      },
    });

    this._postMarketUpdate();
  }

  /**
   * 发送主题更新消息
   * @param colorTheme VS Code 当前主题
   */
  private _postThemeUpdate(colorTheme: vscode.ColorTheme = vscode.window.activeColorTheme): void {
    if (!this._view) {
      return;
    }

    this._view.webview.postMessage({
      command: 'updateTheme',
      payload: {
        theme: this._getThemeInfo(colorTheme),
        prefs: this._getReaderPreferences(),
      },
    });
  }

  /**
   * 向 webview 发送行情占位数据（迭代 1 占位）
   */
  private _postMarketUpdate(): void {
    if (!this._view) {
      return;
    }
    this._view.webview.postMessage({
      command: 'market.update',
      payload: {
        quotes: [],
        lastUpdate: Date.now(),
      },
    });
  }

  /**
   * 导航到指定路由
   */
  public navigateTo(route: string): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'navigate',
        payload: { route },
      });
    } else {
      this._pendingRoute = route;
    }
  }

  /**
   * 导航到操盘手路由
   */
  public navigateMarket(): void {
    this.navigateTo('/market');
  }

  /**
   * 获取当前主题信息
   * @param colorTheme VS Code 主题
   * @returns 主题描述
   */
  private _getThemeInfo(colorTheme: vscode.ColorTheme = vscode.window.activeColorTheme) {
    return {
      kind: this._mapThemeKind(colorTheme.kind),
      themeName: colorTheme.kind === vscode.ColorThemeKind.HighContrast ? 'high-contrast' : colorTheme.kind === vscode.ColorThemeKind.HighContrastLight ? 'high-contrast-light' : 'default',
    };
  }

  /**
   * 获取阅读者主题相关偏好
   */
  private _getReaderPreferences(): { lockTheme: 'auto' | 'light' | 'dark' } {
    const config = vscode.workspace.getConfiguration('side-quest');
    const lockTheme = config.get<'auto' | 'light' | 'dark'>('reader.lockTheme', 'auto');
    return { lockTheme };
  }

  /**
   * 映射 VS Code 主题枚举到 Webview 可用的字符串
   * @param kind VS Code 主题类型
   */
  private _mapThemeKind(kind: vscode.ColorThemeKind): 'light' | 'dark' | 'highContrast' | 'highContrastLight' {
    switch (kind) {
      case vscode.ColorThemeKind.Light:
        return 'light';
      case vscode.ColorThemeKind.Dark:
        return 'dark';
      case vscode.ColorThemeKind.HighContrast:
        return 'highContrast';
      case vscode.ColorThemeKind.HighContrastLight:
        return 'highContrastLight';
      default:
        return 'dark';
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
