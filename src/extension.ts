import * as vscode from 'vscode';
import { SideQuestViewProvider } from './SideQuestViewProvider';
import { logger } from './utils/logger';

export function activate(context: vscode.ExtensionContext) {
	logger.info('Side Quest is now active!');

	// Register the webview view provider
	const provider = new SideQuestViewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			SideQuestViewProvider.viewType,
			provider
		)
	);

	// Register commands
	const helloCommand = vscode.commands.registerCommand('side-quest.helloWorld', () => {
		logger.debug('Hello World command executed');
		vscode.window.showInformationMessage('Hello from Side Quest!');
	});
	context.subscriptions.push(helloCommand);
}

export function deactivate() {
	logger.info('Side Quest deactivated');
}
