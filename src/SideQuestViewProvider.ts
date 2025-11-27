import * as vscode from 'vscode';

export class SideQuestViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'side-quest.mainView';

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case 'alert':
          vscode.window.showInformationMessage(message.text);
          break;
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = this._getNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Side Quest</title>
  <style>
    body {
      padding: 16px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .welcome {
      text-align: center;
      margin-top: 20px;
    }
    .welcome h2 {
      margin-bottom: 8px;
      font-weight: 600;
    }
    .welcome p {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 16px;
    }
    .menu {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 20px;
    }
    .menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background: var(--vscode-button-secondaryBackground);
      border: none;
      border-radius: 6px;
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
      text-align: left;
      transition: background 0.2s;
    }
    .menu-item:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .menu-item .icon {
      font-size: 18px;
    }
    .menu-item .label {
      font-weight: 500;
    }
    .menu-item .desc {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .status {
      margin-top: 20px;
      padding: 8px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 4px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="welcome">
    <h2>Side Quest</h2>
    <p>主线任务交给 AI，支线任务交给你</p>
  </div>

  <div class="menu">
    <button class="menu-item" data-mode="novel">
      <span class="icon">📚</span>
      <div>
        <div class="label">阅读者</div>
        <div class="desc">Novel Mode - 沉浸式阅读</div>
      </div>
    </button>

    <button class="menu-item" data-mode="news">
      <span class="icon">📰</span>
      <div>
        <div class="label">情报员</div>
        <div class="desc">News Mode - 热点聚合</div>
      </div>
    </button>

    <button class="menu-item" data-mode="market">
      <span class="icon">📈</span>
      <div>
        <div class="label">操盘手</div>
        <div class="desc">Market Mode - 盯盘助手</div>
      </div>
    </button>
  </div>

  <div class="status">
    ⚔️ 准备开启支线任务...
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.querySelectorAll('.menu-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        vscode.postMessage({
          command: 'alert',
          text: '功能开发中：' + mode
        });
      });
    });
  </script>
</body>
</html>`;
  }

  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
