import * as vscode from 'vscode';
import type { SideQuestViewProvider } from '../SideQuestViewProvider';

interface WatchItemConfig {
	type: 'stock' | 'crypto' | 'index';
	symbol: string;
	displayName?: string;
	sourceId: string;
}

/**
 * 操盘手配置管理
 * 负责读取 VS Code 配置与默认值
 */
class ConfigManager {
	constructor(private readonly _context: vscode.ExtensionContext) {}

	public getWatchlist(): WatchItemConfig[] {
		const cfg = vscode.workspace.getConfiguration('side-quest.market');
		return cfg.get<WatchItemConfig[]>('watchlist', []);
	}

	public getRefreshInterval(): number {
		const cfg = vscode.workspace.getConfiguration('side-quest.market');
		return cfg.get<number>('refreshInterval', 60);
	}

	public getRotateInterval(): number {
		const cfg = vscode.workspace.getConfiguration('side-quest.market');
		return cfg.get<number>('rotateInterval', 3);
	}

	public getColorMode(): string {
		const cfg = vscode.workspace.getConfiguration('side-quest.market');
		return cfg.get<string>('colorMode', 'default');
	}

	public getAutoRefresh(): boolean {
		const cfg = vscode.workspace.getConfiguration('side-quest.market');
		return cfg.get<boolean>('autoRefresh', true);
	}
}

/**
 * 状态栏控制器
 * 迭代 1 显示占位文案与基础交互
 */
class StatusBarController {
	private readonly item: vscode.StatusBarItem;

	constructor() {
		this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.item.command = 'side-quest.market.show';
		this.item.text = '$(graph-line) 配置操盘手';
		this.item.tooltip = '点击查看行情（操盘手）';
		this.item.show();
	}

	public showLoading(text = '加载中...'): void {
		this.item.text = `$(sync~spin) ${text}`;
	}

	public showPlaceholder(): void {
		this.item.text = '$(graph-line) 配置操盘手';
	}

	public dispose(): void {
		this.item.dispose();
	}
}

/**
 * 数据管理框架（迭代 1 占位，后续填充刷新逻辑）
 */
class DataManager {
	constructor(private readonly _config: ConfigManager) {}

	// 占位：后续补充具体行情获取与定时刷新
	public startAutoRefresh(): void {
		void this._config.getRefreshInterval();
	}

	public stopAutoRefresh(): void {
		// no-op for now
	}
}

/**
 * 操盘手服务入口
 */
export class MarketService {
	private readonly _statusBar: StatusBarController;
	private readonly _config: ConfigManager;
	private readonly _data: DataManager;

	constructor(private readonly _context: vscode.ExtensionContext, private readonly _provider?: SideQuestViewProvider) {
		this._config = new ConfigManager(_context);
		this._statusBar = new StatusBarController();
		this._data = new DataManager(this._config);
		this._context.subscriptions.push(this._statusBar);
	}

	public showMarketView(): void {
		// 展示侧边栏
		void vscode.commands.executeCommand('workbench.view.extension.side-quest');
		// 通知 webview 导航到操盘手
		this._provider?.navigateMarket();
	}

	public refresh(): void {
		this._statusBar.showLoading();
		// 后续补充真实刷新逻辑；占位恢复占位文案
		setTimeout(() => this._statusBar.showPlaceholder(), 300);
	}

	public nextSymbol(): void {
		// 轮播逻辑后续实现，迭代 1 占位
		this._statusBar.showPlaceholder();
	}

	public dispose(): void {
		this._statusBar.dispose();
		this._data.stopAutoRefresh();
	}
}
