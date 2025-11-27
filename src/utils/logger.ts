import * as vscode from 'vscode';

class Logger {
  private static instance: Logger;
  private outputChannel: vscode.LogOutputChannel;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Side Quest', { log: true });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public show(): void {
    this.outputChannel.show();
  }

  public trace(message: string, ...args: unknown[]): void {
    this.outputChannel.trace(message, ...args);
  }

  public debug(message: string, ...args: unknown[]): void {
    this.outputChannel.debug(message, ...args);
  }

  public info(message: string, ...args: unknown[]): void {
    this.outputChannel.info(message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.outputChannel.warn(message, ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    this.outputChannel.error(message, ...args);
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}

export const logger = Logger.getInstance();
