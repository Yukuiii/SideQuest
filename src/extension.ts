import * as vscode from 'vscode';
import { SideQuestViewProvider } from './SideQuestViewProvider';
import { logger } from './utils/logger';
import { MarketService } from './services/marketService';

/**
 * 插件激活时调用
 * 注册 Webview 视图提供者和命令
 * @param context - VS Code 扩展上下文，用于管理订阅和资源
 */
export function activate(context: vscode.ExtensionContext) {
	logger.info('Side Quest is now active!');

	// 注册 Webview 视图提供者
	const provider = new SideQuestViewProvider(context.extensionUri, context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			SideQuestViewProvider.viewType,
			provider
		)
	);

	// 注册操盘手服务
	const marketService = new MarketService(context, provider);
	context.subscriptions.push(marketService);

	// 注册 Hello World 命令
	const helloCommand = vscode.commands.registerCommand('side-quest.helloWorld', () => {
		logger.debug('Hello World command executed');
		vscode.window.showInformationMessage('Hello from Side Quest!');
	});
	context.subscriptions.push(helloCommand);

	// 操盘手相关命令
	context.subscriptions.push(
		vscode.commands.registerCommand('side-quest.market.show', () => {
			marketService.showMarketView();
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('side-quest.market.refresh', () => {
			marketService.refresh();
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('side-quest.market.nextSymbol', () => {
			marketService.nextSymbol();
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('side-quest.market.addWatch', async (item) => {
			await marketService.addWatch(item);
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('side-quest.market.removeWatch', async (symbol: string) => {
			await marketService.removeWatch(symbol);
		})
	);
}

/**
 * 插件停用时调用
 * 用于清理资源
 */
export function deactivate() {
	logger.info('Side Quest deactivated');
}
