import * as vscode from 'vscode';

/**
 * 日志管理类
 * 单例模式，提供统一的日志输出功能，输出到 VS Code 的 Output 面板
 */
class Logger {
  /** 单例实例 */
  private static instance: Logger;
  /** VS Code 日志输出通道 */
  private outputChannel: vscode.LogOutputChannel;

  /**
   * 私有构造函数，创建日志输出通道
   */
  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Side Quest', { log: true });
  }

  /**
   * 获取 Logger 单例实例
   * @returns Logger 实例
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 显示日志输出面板
   */
  public show(): void {
    this.outputChannel.show();
  }

  /**
   * 输出追踪级别日志
   * @param message - 日志消息
   * @param args - 附加参数
   */
  public trace(message: string, ...args: unknown[]): void {
    this.outputChannel.trace(message, ...args);
  }

  /**
   * 输出调试级别日志
   * @param message - 日志消息
   * @param args - 附加参数
   */
  public debug(message: string, ...args: unknown[]): void {
    this.outputChannel.debug(message, ...args);
  }

  /**
   * 输出信息级别日志
   * @param message - 日志消息
   * @param args - 附加参数
   */
  public info(message: string, ...args: unknown[]): void {
    this.outputChannel.info(message, ...args);
  }

  /**
   * 输出警告级别日志
   * @param message - 日志消息
   * @param args - 附加参数
   */
  public warn(message: string, ...args: unknown[]): void {
    this.outputChannel.warn(message, ...args);
  }

  /**
   * 输出错误级别日志
   * @param message - 日志消息
   * @param args - 附加参数
   */
  public error(message: string, ...args: unknown[]): void {
    this.outputChannel.error(message, ...args);
  }

  /**
   * 释放日志输出通道资源
   */
  public dispose(): void {
    this.outputChannel.dispose();
  }
}

/** 导出 Logger 单例 */
export const logger = Logger.getInstance();
