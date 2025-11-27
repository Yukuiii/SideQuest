import * as vscode from 'vscode';
import { SideQuestViewProvider } from './SideQuestViewProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Side Quest is now active!');

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
		vscode.window.showInformationMessage('Hello from Side Quest!');
	});
	context.subscriptions.push(helloCommand);
}

export function deactivate() {}
