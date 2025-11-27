/**
 * HTTP 请求服务
 * 为 webview 提供代理请求能力，绕过 CORS 限制
 */

import * as https from "https";
import * as http from "http";
import { URL } from "url";
import * as zlib from "zlib";
import { logger } from "../utils/logger";

/** HTTP 请求选项 */
export interface HttpRequestOptions {
  /** 请求 URL */
  url: string;
  /** 请求方法 */
  method?: "GET" | "POST";
  /** 请求头 */
  headers?: Record<string, string>;
  /** POST 请求体 */
  body?: string;
  /** 字符编码 */
  charset?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/** HTTP 响应结果 */
export interface HttpResponse {
  /** 是否成功 */
  success: boolean;
  /** 状态码 */
  statusCode?: number;
  /** 响应头 */
  headers?: Record<string, string | string[] | undefined>;
  /** 响应内容 */
  data?: string;
  /** 错误信息 */
  error?: string;
}

/** 默认请求头 */
const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate",
  Connection: "keep-alive",
};

/** 默认超时时间 */
const DEFAULT_TIMEOUT = 30000;

/**
 * 发起 HTTP 请求
 * @param options 请求选项
 * @returns 响应结果
 */
export async function httpRequest(
  options: HttpRequestOptions
): Promise<HttpResponse> {
  const {
    url,
    method = "GET",
    headers = {},
    body,
    charset = "utf-8",
    timeout = DEFAULT_TIMEOUT,
  } = options;

  logger.debug(`HTTP ${method} ${url}`);

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === "https:";
      const httpModule = isHttps ? https : http;

      const requestHeaders: Record<string, string> = {
        ...DEFAULT_HEADERS,
        ...headers,
        Host: parsedUrl.host,
      };

      // POST 请求添加 Content-Type
      if (method === "POST" && body && !requestHeaders["Content-Type"]) {
        requestHeaders["Content-Type"] = "application/x-www-form-urlencoded";
      }

      const requestOptions: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: requestHeaders,
        timeout,
      };

      const req = httpModule.request(requestOptions, (res) => {
        const chunks: Buffer[] = [];

        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const encoding = res.headers["content-encoding"];

          // 解压缩
          decompressBuffer(buffer, encoding)
            .then((decompressed) => {
              // 解码字符串
              const data = decodeBuffer(
                decompressed,
                charset,
                res.headers["content-type"]
              );

              resolve({
                success: true,
                statusCode: res.statusCode,
                headers: res.headers as Record<
                  string,
                  string | string[] | undefined
                >,
                data,
              });
            })
            .catch((err) => {
              logger.error("解压响应失败:", err);
              resolve({
                success: false,
                statusCode: res.statusCode,
                error: `解压失败: ${err.message}`,
              });
            });
        });

        res.on("error", (err) => {
          logger.error("响应错误:", err);
          resolve({
            success: false,
            error: `响应错误: ${err.message}`,
          });
        });
      });

      req.on("error", (err) => {
        logger.error("请求错误:", err);
        resolve({
          success: false,
          error: `请求错误: ${err.message}`,
        });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({
          success: false,
          error: `请求超时 (${timeout}ms)`,
        });
      });

      // 发送 POST 数据
      if (method === "POST" && body) {
        req.write(body);
      }

      req.end();
    } catch (err) {
      const error = err instanceof Error ? err.message : "未知错误";
      logger.error("HTTP 请求异常:", error);
      resolve({
        success: false,
        error: `请求异常: ${error}`,
      });
    }
  });
}

/**
 * 解压缩 Buffer
 * @param buffer 原始数据
 * @param encoding 编码类型
 * @returns 解压后的数据
 */
async function decompressBuffer(
  buffer: Buffer,
  encoding?: string
): Promise<Buffer> {
  if (!encoding) {
    return buffer;
  }

  return new Promise((resolve, reject) => {
    if (encoding === "gzip") {
      zlib.gunzip(buffer, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    } else if (encoding === "deflate") {
      zlib.inflate(buffer, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    } else if (encoding === "br") {
      zlib.brotliDecompress(buffer, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    } else {
      resolve(buffer);
    }
  });
}

/**
 * 解码 Buffer 为字符串
 * @param buffer 数据
 * @param charset 字符编码
 * @param contentType Content-Type 头
 * @returns 解码后的字符串
 */
function decodeBuffer(
  buffer: Buffer,
  charset: string,
  contentType?: string
): string {
  // 从 Content-Type 中提取 charset
  let encoding = charset;
  if (contentType) {
    const match = contentType.match(/charset=([^\s;]+)/i);
    if (match) {
      encoding = match[1].toLowerCase();
    }
  }

  // 常见编码映射
  const encodingMap: Record<string, BufferEncoding> = {
    "utf-8": "utf8",
    utf8: "utf8",
    gbk: "latin1", // Node.js 不直接支持 GBK，需要额外处理
    gb2312: "latin1",
    gb18030: "latin1",
    "iso-8859-1": "latin1",
    latin1: "latin1",
  };

  const nodeEncoding = encodingMap[encoding.toLowerCase()] || "utf8";

  // GBK 等中文编码需要特殊处理
  if (["gbk", "gb2312", "gb18030"].includes(encoding.toLowerCase())) {
    // 使用 TextDecoder 处理中文编码
    try {
      const decoder = new TextDecoder(encoding);
      return decoder.decode(buffer);
    } catch {
      // 降级处理
      return buffer.toString(nodeEncoding);
    }
  }

  return buffer.toString(nodeEncoding);
}

/**
 * HTTP 服务类（单例）
 */
export class HttpService {
  private static instance: HttpService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): HttpService {
    if (!HttpService.instance) {
      HttpService.instance = new HttpService();
    }
    return HttpService.instance;
  }

  /**
   * 发起 GET 请求
   * @param url 请求 URL
   * @param options 额外选项
   */
  public async get(
    url: string,
    options?: Omit<HttpRequestOptions, "url" | "method">
  ): Promise<HttpResponse> {
    return httpRequest({ ...options, url, method: "GET" });
  }

  /**
   * 发起 POST 请求
   * @param url 请求 URL
   * @param body 请求体
   * @param options 额外选项
   */
  public async post(
    url: string,
    body?: string,
    options?: Omit<HttpRequestOptions, "url" | "method" | "body">
  ): Promise<HttpResponse> {
    return httpRequest({ ...options, url, method: "POST", body });
  }
}

/** 默认 HTTP 服务实例 */
export const httpService = HttpService.getInstance();
