import * as vscode from 'vscode';
import type { SideQuestViewProvider } from '../SideQuestViewProvider';
import { httpService } from './httpService';
import { logger } from '../utils/logger';

interface WatchItemConfig {
	type: 'stock' | 'crypto' | 'index';
	symbol: string;
	displayName?: string;
	sourceId: string;
}

interface Quote {
	symbol: string;
	displayName?: string;
	price: number;
	change: number;
	changePercent: number;
	timestamp: number;
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

	public async setWatchlist(items: WatchItemConfig[]): Promise<void> {
		await this._context.globalState.update('side-quest.market.watchlist', items);
	}

	public getPersistedWatchlist(): WatchItemConfig[] {
		const stored = this._context.globalState.get<WatchItemConfig[]>('side-quest.market.watchlist');
		return stored ?? [];
	}
}

/**
 * 状态栏控制器
 * 迭代 1 显示占位文案与基础交互
 */
class StatusBarController {
	private readonly item: vscode.StatusBarItem;
	private current?: Quote;

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

	public showError(message = '行情加载失败'): void {
		this.item.text = '$(error) 行情错误';
		this.item.tooltip = message;
		this.item.color = new vscode.ThemeColor('charts.red');
	}

	public showQuote(quote: Quote, colorMode: 'default' | 'reverse' | 'theme' = 'default'): void {
		this.current = quote;
		const dir = quote.changePercent === 0 ? '' : quote.changePercent > 0 ? '▲' : '▼';
		const priceText = Number.isFinite(quote.price) ? quote.price.toFixed(2) : '--';
		const changeText = Number.isFinite(quote.changePercent) ? `${Math.abs(quote.changePercent).toFixed(2)}%` : '--';
		this.item.text = `$(graph-line) ${quote.symbol} ${priceText} ${dir}${changeText}`;
		this.item.tooltip = `${quote.displayName || quote.symbol}\n价格: ${priceText}\n涨跌: ${quote.change.toFixed(2)} (${quote.changePercent.toFixed(2)}%)\n更新时间: ${new Date(quote.timestamp).toLocaleTimeString()}`;

		if (quote.changePercent === 0) {
			this.item.color = undefined;
			return;
		}

		const isUp = quote.changePercent > 0;
		if (colorMode === 'reverse') {
			this.item.color = isUp ? new vscode.ThemeColor('charts.red') : new vscode.ThemeColor('charts.green');
		} else if (colorMode === 'theme') {
			this.item.color = isUp ? new vscode.ThemeColor('charts.foreground') : new vscode.ThemeColor('charts.foreground');
		} else {
			this.item.color = isUp ? new vscode.ThemeColor('charts.green') : new vscode.ThemeColor('charts.red');
		}
	}

	public dispose(): void {
		this.item.dispose();
	}
}

/**
 * 数据管理框架（迭代 1 占位，后续填充刷新逻辑）
 */
class DataManager {
	private refreshTimer: NodeJS.Timeout | null = null;
	private rotateTimer: NodeJS.Timeout | null = null;
	private currentIndex = 0;
	private cache = new Map<string, Quote>();
	private lastUpdate = 0;

	constructor(
		private readonly _config: ConfigManager,
		private readonly _onQuotes: (quotes: Quote[], lastUpdate: number) => void,
		private readonly _onStatus?: (quote: Quote | undefined) => void,
		private readonly _onError?: (message: string) => void
	) {}

	public startAutoRefresh(): void {
		this.stopAutoRefresh();
		logger.info('[Market] start auto refresh', {
			refreshInterval: this._config.getRefreshInterval(),
			rotateInterval: this._config.getRotateInterval(),
		});
		this.fetchQuotes();
		const refreshMs = Math.max(5, this._config.getRefreshInterval()) * 1000;
		this.refreshTimer = setInterval(() => this.fetchQuotes(), refreshMs);

		const rotateMs = Math.max(1, this._config.getRotateInterval()) * 1000;
		this.rotateTimer = setInterval(() => this.rotate(), rotateMs);
	}

	public stopAutoRefresh(): void {
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer);
			this.refreshTimer = null;
		}
		if (this.rotateTimer) {
			clearInterval(this.rotateTimer);
			this.rotateTimer = null;
		}
	}

	public rotate(): void {
		const quotes = Array.from(this.cache.values());
		if (quotes.length === 0) {
			return;
		}
		this.currentIndex = (this.currentIndex + 1) % quotes.length;
		const quote = quotes[this.currentIndex];
		this._onStatus?.(quote);
	}

	public async fetchQuotes(): Promise<void> {
		try {
			const stored = this._config.getPersistedWatchlist();
			const watchlist = stored.length > 0 ? stored : this._config.getWatchlist();
			const list: WatchItemConfig[] = watchlist.length > 0 ? watchlist : [{ type: 'stock', symbol: 'AAPL', sourceId: 'yahoo', displayName: 'Apple' }];
			logger.info('[Market] fetchQuotes', { count: list.length, symbols: list.map((i) => i.symbol) });

			const quotes = await this._fetchYahoo(list);
			logger.info('[Market] fetchQuotes res',quotes);

			if (quotes.length > 0) {
				quotes.forEach((q) => this.cache.set(q.symbol, q));
				this.lastUpdate = Date.now();
				this.currentIndex = 0;
				this._onQuotes(quotes, this.lastUpdate);
				this._onStatus?.(quotes[0]);
				logger.info('[Market] quotes updated', { count: quotes.length, ts: this.lastUpdate });
				return;
			}

			if (this.cache.size > 0) {
				const cached = Array.from(this.cache.values());
				this._onQuotes(cached, this.lastUpdate);
				this._onStatus?.(cached[0]);
				this._onError?.('使用缓存数据，可能已过期');
				return;
			}

			this._onError?.('未获取到行情数据');
		} catch (err) {
			console.error('[Market] fetchQuotes failed', err);
			logger.error('[Market] fetchQuotes failed', err);
			if (this.cache.size > 0) {
				const cached = Array.from(this.cache.values());
				this._onQuotes(cached, this.lastUpdate);
				this._onStatus?.(cached[0]);
				this._onError?.('网络异常，正在使用缓存数据');
				return;
			}
			this._onError?.('行情获取失败，请检查网络或稍后重试');
		}
	}

	private async _fetchYahoo(items: WatchItemConfig[]): Promise<Quote[]> {
		const symbols = items.map((i) => i.symbol).join(',');
		const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
		try {
			logger.debug('[Market] yahoo request', { url });
			const res = await httpService.get(url, { timeout: 8000 });
			const json = typeof res === 'string' ? JSON.parse(res) : res;
			const results: any[] = json?.quoteResponse?.result || [];
			logger.debug('[Market] yahoo response count', { count: results.length });
			return results.map((r) => {
				const base = items.find((i) => i.symbol.toLowerCase() === String(r.symbol || '').toLowerCase());
				return {
					symbol: String(r.symbol || base?.symbol || ''),
					displayName: base?.displayName || r.shortName || r.longName,
					price: Number(r.regularMarketPrice) || 0,
					change: Number(r.regularMarketChange) || 0,
					changePercent: Number(r.regularMarketChangePercent) || 0,
					timestamp: Number(r.regularMarketTime) ? Number(r.regularMarketTime) * 1000 : Date.now(),
					sourceId: base?.sourceId || 'yahoo',
				} as Quote;
			}).filter((q) => q.symbol);
		} catch (err) {
			console.error('[Market] Yahoo fetch failed, using cache', err);
			logger.error('[Market] Yahoo fetch failed', err);
			return Array.from(this.cache.values());
		}
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
		this._data = new DataManager(
			this._config,
			(quotes, lastUpdate) => {
				this._provider?.postMarketUpdate(quotes, lastUpdate);
			},
			(quote) => {
				if (quote) {
					const mode = this._config.getColorMode() as 'default' | 'reverse' | 'theme';
					this._statusBar.showQuote(quote, mode);
				} else {
					this._statusBar.showPlaceholder();
				}
			},
			(message) => {
				this._statusBar.showError(message);
			}
		);
		this._context.subscriptions.push(this._statusBar);
		if (this._config.getAutoRefresh()) {
			this._data.startAutoRefresh();
		}
	}

	public showMarketView(): void {
		// 展示侧边栏
		void vscode.commands.executeCommand('workbench.view.extension.side-quest');
		// 通知 webview 导航到操盘手
		this._provider?.navigateMarket();
	}

	public refresh(): void {
		this._statusBar.showLoading();
		void this._data.fetchQuotes();
	}

	public nextSymbol(): void {
		this._data.rotate();
	}

	public async addWatch(item: WatchItemConfig): Promise<void> {
		if (!item.symbol || item.symbol.trim().length === 0) {
			void vscode.window.showErrorMessage('标的代码不能为空');
			return;
		}
		const current = this._config.getPersistedWatchlist();
		const exists = current.some((w) => w.symbol.toLowerCase() === item.symbol.toLowerCase());
		if (!exists) {
			current.push(item);
			await this._config.setWatchlist(current);
		} else {
			void vscode.window.showInformationMessage(`${item.symbol} 已在自选列表中`);
			return;
		}
		await this._data.fetchQuotes();
	}

	public async removeWatch(symbol: string): Promise<void> {
		const current = this._config.getPersistedWatchlist();
		const next = current.filter((w) => w.symbol.toLowerCase() !== symbol.toLowerCase());
		await this._config.setWatchlist(next);
		await this._data.fetchQuotes();
	}

	public dispose(): void {
		this._statusBar.dispose();
		this._data.stopAutoRefresh();
	}
}
