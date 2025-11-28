/**
 * ESO 书源解析器
 * 支持 Any-Reader 的 ESO 规则格式
 *
 * ESO 规则格式参考: https://aooiuu.github.io/any-reader/rule/
 *
 * 规则解析语法：
 * - @css: CSS 选择器查询，如 `.box1 .box2@text`
 * - @json: JSONPath 查询，如 `$.list[:1].title`
 * - @xpath: XPath 查询，如 `//*[@class="box3"]/text()`
 * - @js: JavaScript 执行，如 `@js:1+1` 或异步函数
 * - @filter: 链接正则匹配，如 `(?:m3u8|mp4)`
 * - @replace: 移除匹配内容，如 `@replace:\d`
 * - ##: 正则替换，如 `$.a##正则##替换文本`
 * - ||: 或运算，依次尝试直到成功
 * - &&: 嵌套组合
 * - {{}}: 变量插值
 */

import type { BookSourceType, UnifiedSource } from "./types";
import type { EsoSource, EsoParsedRule, EsoParsedUrlRule } from "./esoTypes";
import { EsoContentType } from "./esoTypes";

// 重新导出类型供外部使用
export type { EsoSource, EsoParsedRule, EsoParsedUrlRule } from "./esoTypes";
export { EsoContentType } from "./esoTypes";

/**
 * 解析单个 ESO 书源
 * @param jsonString JSON 格式的书源字符串
 * @returns 解析后的 ESO 书源对象
 * @throws 解析失败时抛出错误
 */
export function parseEsoSource(jsonString: string): EsoSource {
  try {
    const source = JSON.parse(jsonString) as EsoSource;

    // 验证必要字段
    if (!source.name) {
      throw new Error("缺少规则名称 (name)");
    }
    if (!source.host) {
      throw new Error("缺少域名 (host)");
    }
    if (!source.id) {
      // 如果没有 ID，自动生成一个
      source.id = generateEsoId(source.host + source.name);
    }

    return source;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("无效的 JSON 格式");
    }
    throw error;
  }
}

/**
 * 解析 ESO 书源数组
 * @param jsonString JSON 格式的书源数组字符串
 * @returns 解析后的 ESO 书源对象数组
 */
export function parseEsoSources(jsonString: string): EsoSource[] {
  try {
    const data = JSON.parse(jsonString);

    // 支持单个对象或数组
    const sources = Array.isArray(data) ? data : [data];

    // 验证并过滤有效书源
    return sources.filter((source): source is EsoSource => {
      return (
        typeof source === "object" &&
        source !== null &&
        typeof source.name === "string" &&
        typeof source.host === "string"
      );
    }).map((source) => {
      // 确保每个源都有 ID
      if (!source.id) {
        source.id = generateEsoId(source.host + source.name);
      }
      return source;
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("无效的 JSON 格式");
    }
    throw error;
  }
}

/**
 * 批量解析 ESO 书源（带错误信息）
 * @param jsonString JSON 格式的书源字符串
 * @returns 解析结果数组
 */
export function parseEsoSourcesWithErrors(
  jsonString: string
): Array<{ success: boolean; source?: EsoSource; error?: string; index: number }> {
  try {
    const data = JSON.parse(jsonString);
    const sources = Array.isArray(data) ? data : [data];

    return sources.map((item, index) => {
      if (typeof item !== "object" || item === null) {
        return { success: false, error: "无效的书源对象", index };
      }

      if (!item.name) {
        return { success: false, error: "缺少规则名称 (name)", index };
      }

      if (!item.host) {
        return { success: false, error: "缺少域名 (host)", index };
      }

      // 自动生成 ID
      if (!item.id) {
        item.id = generateEsoId(item.host + item.name);
      }

      return { success: true, source: item as EsoSource, index };
    });
  } catch (error) {
    return [
      {
        success: false,
        error: error instanceof Error ? error.message : "解析失败",
        index: 0,
      },
    ];
  }
}

/**
 * 验证是否为有效的 ESO 书源格式
 * @param str 待验证的字符串
 * @returns 是否为有效的 ESO 格式
 */
export function isValidEsoFormat(str: string): boolean {
  try {
    const data = JSON.parse(str);
    const sources = Array.isArray(data) ? data : [data];

    return sources.some(
      (source) =>
        typeof source === "object" &&
        source !== null &&
        typeof source.name === "string" &&
        typeof source.host === "string" &&
        // ESO 特有字段检测
        (source.contentType !== undefined ||
          source.searchList !== undefined ||
          source.chapterList !== undefined ||
          source.contentItems !== undefined)
    );
  } catch {
    return false;
  }
}

/**
 * 将 ESO 书源转换为统一格式
 * @param esoSource ESO 书源对象
 * @returns 统一格式的书源对象
 */
export function convertEsoToUnified(esoSource: EsoSource): UnifiedSource {
  // ESO contentType 到内部 BookSourceType 的映射
  // ESO: 0=漫画, 1=小说, 2=视频, 3=音频, 4=RSS, 5=小说更多
  // 内部: 0=小说, 1=漫画, 2=音频
  let type: BookSourceType;
  switch (esoSource.contentType) {
    case EsoContentType.Manga:
      type = 1; // 漫画
      break;
    case EsoContentType.Audio:
    case EsoContentType.Video: // 视频暂时映射为音频
      type = 2; // 音频
      break;
    case EsoContentType.Novel:
    case EsoContentType.NovelMore:
    case EsoContentType.RSS:
    default:
      type = 0; // 小说
      break;
  }

  return {
    id: esoSource.id,
    name: esoSource.name,
    url: esoSource.host,
    type,
    group: esoSource.author, // 使用作者作为分组
    enabled: true,
    raw: esoSource, // 保留原始数据
  };
}

/**
 * 批量转换 ESO 书源为统一格式
 * @param esoSources ESO 书源数组
 * @returns 统一格式的书源数组
 */
export function convertEsoSourcesToUnified(esoSources: EsoSource[]): UnifiedSource[] {
  return esoSources.map(convertEsoToUnified);
}

/**
 * 编码 ESO 书源为 JSON 字符串（用于导出）
 * @param sources ESO 书源数组
 * @param pretty 是否格式化输出
 * @returns JSON 字符串
 */
export function encodeEsoSources(sources: EsoSource[], pretty = true): string {
  return JSON.stringify(sources, null, pretty ? 2 : undefined);
}

/**
 * 生成 ESO 书源唯一 ID
 * @param seed 种子字符串
 * @returns UUID 格式的 ID
 */
function generateEsoId(seed: string): string {
  // 简单的哈希函数生成伪 UUID
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `eso-${hex.slice(0, 8)}-${hex.slice(0, 4)}-${hex.slice(0, 4)}-${hex.slice(0, 4)}-${hex.slice(0, 12).padEnd(12, "0")}`;
}

// ==================== 规则解析引擎 ====================

/**
 * 解析 ESO 规则字符串
 * @param rule 规则字符串
 * @returns 解析后的规则对象
 */
export function parseEsoRule(rule: string): EsoParsedRule {
  if (!rule || typeof rule !== "string") {
    return { type: "raw", selector: "" };
  }

  const trimmedRule = rule.trim();

  // 检查 || 组合规则（或运算）
  if (trimmedRule.includes("||")) {
    return {
      type: "raw",
      selector: "",
      combinator: "or",
      subRules: trimmedRule.split("||").map((r) => parseEsoRule(r.trim())),
    };
  }

  // 检查 && 组合规则（嵌套组合）
  if (trimmedRule.includes("&&")) {
    return {
      type: "raw",
      selector: "",
      combinator: "and",
      subRules: trimmedRule.split("&&").map((r) => parseEsoRule(r.trim())),
    };
  }

  // 处理正则替换 ##
  let remaining = trimmedRule;
  let regex: string | undefined;
  let replacement: string | undefined;

  const regexMatch = remaining.match(/##(.+?)(?:##(.*))?$/);
  if (regexMatch) {
    regex = regexMatch[1];
    replacement = regexMatch[2];
    remaining = remaining.slice(0, remaining.indexOf("##"));
  }

  // 检查 @js: 前缀
  if (remaining.startsWith("@js:")) {
    return {
      type: "js",
      selector: "",
      jsCode: remaining.slice(4).trim(),
      regex,
      replacement,
    };
  }

  // 检查 @json: 前缀
  if (remaining.startsWith("@json:")) {
    return {
      type: "json",
      selector: remaining.slice(6).trim(),
      regex,
      replacement,
    };
  }

  // 检查 JSONPath 格式（$.xxx 或 $[xxx]）
  if (remaining.startsWith("$.") || remaining.startsWith("$[")) {
    return {
      type: "json",
      selector: remaining,
      regex,
      replacement,
    };
  }

  // 检查 @xpath: 前缀
  if (remaining.toLowerCase().startsWith("@xpath:")) {
    return {
      type: "xpath",
      selector: remaining.slice(7).trim(),
      regex,
      replacement,
    };
  }

  // 检查 XPath 格式（// 开头）
  if (remaining.startsWith("//")) {
    return {
      type: "xpath",
      selector: remaining,
      regex,
      replacement,
    };
  }

  // 检查 @css: 前缀
  if (remaining.toLowerCase().startsWith("@css:")) {
    remaining = remaining.slice(5).trim();
  }

  // 检查 @filter: 前缀
  if (remaining.startsWith("@filter:")) {
    return {
      type: "filter",
      selector: remaining.slice(8).trim(),
      regex,
      replacement,
    };
  }

  // 检查 @replace: 前缀
  if (remaining.startsWith("@replace:")) {
    return {
      type: "replace",
      selector: "",
      regex: remaining.slice(9).trim(),
      replacement: "",
    };
  }

  // 默认作为 CSS 选择器处理
  // 解析 CSS 选择器和属性 (格式: selector@attr 或 @attr)
  let selector = remaining;
  let attr: string | undefined;

  // 检查纯属性格式 @attr（没有选择器，表示从当前元素提取）
  const pureAttrMatch = remaining.match(/^@(\w+)$/);
  if (pureAttrMatch) {
    selector = "";
    attr = pureAttrMatch[1];
  } else {
    // 检查 selector@attr 格式
    const attrMatch = remaining.match(/^(.+?)@(\w+)$/);
    if (attrMatch) {
      selector = attrMatch[1]?.trim() || "";
      attr = attrMatch[2];
    }
  }

  return {
    type: "css",
    selector,
    attr,
    regex,
    replacement,
  };
}

/**
 * 执行 ESO 规则提取
 * @param element DOM 元素或字符串
 * @param rule 解析后的规则
 * @param context 上下文（用于 JS 执行和变量）
 * @returns 提取结果
 */
export function executeEsoRule(
  element: Element | string | null,
  rule: EsoParsedRule,
  context?: Record<string, unknown>
): string | string[] | null {
  if (!element) {
    return null;
  }

  // 处理组合规则
  if (rule.combinator && rule.subRules) {
    if (rule.combinator === "or") {
      // OR: 返回第一个有结果的
      for (const subRule of rule.subRules) {
        const result = executeEsoRule(element, subRule, context);
        if (result && (typeof result === "string" ? result.length > 0 : result.length > 0)) {
          return result;
        }
      }
      return null;
    } else {
      // AND: 嵌套执行，上一个结果作为下一个的输入
      let currentResult: string | string[] | null = typeof element === "string" ? element : null;
      for (const subRule of rule.subRules) {
        const input = currentResult
          ? (Array.isArray(currentResult) ? currentResult[0] : currentResult)
          : element;
        currentResult = executeEsoRule(
          typeof input === "string" ? input : element,
          subRule,
          { ...context, result: currentResult, lastResult: currentResult }
        );
        if (!currentResult) {
          break;
        }
      }
      return currentResult;
    }
  }

  // 处理 JavaScript
  if (rule.type === "js" && rule.jsCode) {
    return executeEsoJsRule(rule.jsCode, element, context);
  }

  // 处理 @replace 规则
  if (rule.type === "replace" && rule.regex) {
    if (typeof element === "string") {
      return applyEsoRegex(element, rule.regex, "");
    }
    const text = element.textContent?.trim() || "";
    return applyEsoRegex(text, rule.regex, "");
  }

  // 处理字符串输入
  if (typeof element === "string") {
    // JSON 解析
    if (rule.type === "json") {
      const jsonResult = executeJsonPath(element, rule.selector);
      return applyEsoRegex(jsonResult, rule.regex, rule.replacement);
    }
    return applyEsoRegex(element, rule.regex, rule.replacement);
  }

  let value: string | null = null;

  switch (rule.type) {
    case "css":
      value = executeCssSelector(element, rule.selector, rule.attr);
      break;
    case "xpath":
      value = executeXPath(element, rule.selector);
      break;
    case "json": {
      // 从元素中提取 JSON 文本后解析
      const jsonText = element.textContent?.trim() || "";
      value = executeJsonPath(jsonText, rule.selector);
      break;
    }
    case "filter":
      // 过滤器用于匹配链接
      value = executeFilter(element, rule.selector);
      break;
    default:
      value = element.textContent?.trim() || null;
  }

  // 应用正则
  if (value && rule.regex) {
    value = applyEsoRegex(value, rule.regex, rule.replacement);
  }

  return value;
}

/**
 * 执行 ESO 规则提取（返回数组）
 * @param element DOM 元素
 * @param rule 解析后的规则
 * @param context 上下文
 * @returns 提取结果数组
 */
export function executeEsoRuleAll(
  element: Element | null,
  rule: EsoParsedRule,
  context?: Record<string, unknown>
): string[] {
  if (!element || !rule.selector) {
    return [];
  }

  const results: string[] = [];

  if (rule.type === "css") {
    try {
      const elements = element.querySelectorAll(rule.selector);
      for (const el of elements) {
        let value = extractEsoAttribute(el, rule.attr);
        if (value && rule.regex) {
          value = applyEsoRegex(value, rule.regex, rule.replacement);
        }
        if (value) {
          results.push(value);
        }
      }
    } catch {
      // CSS 选择器无效
    }
  } else if (rule.type === "json") {
    const jsonText = element.textContent?.trim() || "";
    const jsonResult = executeJsonPathAll(jsonText, rule.selector);
    for (let value of jsonResult) {
      if (rule.regex) {
        const processed = applyEsoRegex(value, rule.regex, rule.replacement);
        if (processed) {
          value = processed;
        }
      }
      results.push(value);
    }
  } else {
    // 其他类型返回单个结果
    const result = executeEsoRule(element, rule, context);
    if (result) {
      if (Array.isArray(result)) {
        results.push(...result);
      } else {
        results.push(result);
      }
    }
  }

  return results;
}

/**
 * 解析并执行 ESO 规则（便捷方法）
 * @param element DOM 元素或字符串
 * @param ruleString 规则字符串
 * @param context 上下文
 * @returns 提取结果
 */
export function parseAndExecuteEso(
  element: Element | string | null,
  ruleString: string,
  context?: Record<string, unknown>
): string | string[] | null {
  const rule = parseEsoRule(ruleString);
  return executeEsoRule(element, rule, context);
}

// ==================== 内部辅助函数 ====================

/**
 * 执行 CSS 选择器
 */
function executeCssSelector(element: Element, selector: string, attr?: string): string | null {
  if (!selector) {
    return extractEsoAttribute(element, attr);
  }

  try {
    const target = element.querySelector(selector);
    if (!target) {
      return null;
    }
    return extractEsoAttribute(target, attr);
  } catch {
    return null;
  }
}

/**
 * 执行 XPath 表达式
 */
function executeXPath(element: Element, xpath: string): string | null {
  try {
    const doc = element.ownerDocument;
    const result = doc.evaluate(xpath, element, null, XPathResult.STRING_TYPE, null);
    return result.stringValue || null;
  } catch {
    return null;
  }
}

/**
 * 执行 JSONPath 查询
 * 简化实现，支持基本的 JSONPath 语法
 */
function executeJsonPath(jsonStr: string, path: string): string | null {
  try {
    const data = JSON.parse(jsonStr);
    const result = getJsonPathValue(data, path);
    return result !== null && result !== undefined ? String(result) : null;
  } catch {
    return null;
  }
}

/**
 * 执行 JSONPath 查询（返回数组）
 */
function executeJsonPathAll(jsonStr: string, path: string): string[] {
  try {
    const data = JSON.parse(jsonStr);
    const result = getJsonPathValue(data, path);
    if (Array.isArray(result)) {
      return result.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item)));
    }
    return result !== null && result !== undefined ? [String(result)] : [];
  } catch {
    return [];
  }
}

/**
 * 获取 JSONPath 值
 * 简化实现，支持 $.key.key[index] 格式
 */
function getJsonPathValue(data: unknown, path: string): unknown {
  if (!path || path === "$") {
    return data;
  }

  // 移除开头的 $. 或 $
  const normalizedPath = path.replace(/^\$\.?/, "");

  // 解析路径
  const parts = normalizedPath.match(/[^.[\]]+|\[\d+\]|\[:\d+\]|\[\d+:\]|\[\d+:\d+\]/g) || [];

  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return null;
    }

    // 数组索引 [0]
    const indexMatch = part.match(/^\[(\d+)\]$/);
    if (indexMatch) {
      if (!Array.isArray(current)) {
        return null;
      }
      current = current[parseInt(indexMatch[1]!, 10)];
      continue;
    }

    // 数组切片 [:n] - 前 n 个
    const sliceStartMatch = part.match(/^\[:(\d+)\]$/);
    if (sliceStartMatch) {
      if (!Array.isArray(current)) {
        return null;
      }
      current = current.slice(0, parseInt(sliceStartMatch[1]!, 10));
      continue;
    }

    // 数组切片 [n:] - 从 n 开始
    const sliceEndMatch = part.match(/^\[(\d+):\]$/);
    if (sliceEndMatch) {
      if (!Array.isArray(current)) {
        return null;
      }
      current = current.slice(parseInt(sliceEndMatch[1]!, 10));
      continue;
    }

    // 数组切片 [n:m]
    const sliceRangeMatch = part.match(/^\[(\d+):(\d+)\]$/);
    if (sliceRangeMatch) {
      if (!Array.isArray(current)) {
        return null;
      }
      current = current.slice(
        parseInt(sliceRangeMatch[1]!, 10),
        parseInt(sliceRangeMatch[2]!, 10)
      );
      continue;
    }

    // 对象属性
    if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }

  return current;
}

/**
 * 执行过滤器规则
 */
function executeFilter(element: Element, pattern: string): string | null {
  try {
    const regex = new RegExp(pattern);
    const links = element.querySelectorAll("a[href], [src]");
    for (const el of links) {
      const href = el.getAttribute("href") || el.getAttribute("src");
      if (href && regex.test(href)) {
        return href;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 从元素提取属性值
 */
function extractEsoAttribute(element: Element, attr?: string): string | null {
  if (!attr) {
    return element.textContent?.trim() || null;
  }

  const attrLower = attr.toLowerCase();

  switch (attrLower) {
    case "text":
      return element.textContent?.trim() || null;
    case "html":
    case "innerhtml":
      return element.innerHTML;
    case "outerhtml":
      return element.outerHTML;
    case "href":
      return element.getAttribute("href");
    case "src":
      return element.getAttribute("src");
    case "data-original":
      return element.getAttribute("data-original");
    default:
      return element.getAttribute(attr);
  }
}

/**
 * 应用正则表达式
 */
function applyEsoRegex(value: string | null, regex?: string, replacement?: string): string | null {
  if (!value || !regex) {
    return value;
  }

  try {
    const re = new RegExp(regex, "g");
    const result = value.replace(re, replacement ?? "");
    return result.trim() || null;
  } catch {
    return value;
  }
}

/**
 * 执行 JavaScript 规则
 */
function executeEsoJsRule(
  code: string,
  element: Element | string | null,
  context?: Record<string, unknown>
): string | null {
  try {
    // 创建执行上下文
    const evalContext = {
      result: typeof element === "string" ? element : element?.innerHTML || "",
      element,
      ...context,
    };

    // 使用 Function 构造器执行代码
    const fn = new Function(...Object.keys(evalContext), `return (${code})`);
    const result = fn(...Object.values(evalContext));

    return result !== null && result !== undefined ? String(result) : null;
  } catch (error) {
    console.error("[ESO] JS 规则执行失败:", error);
    return null;
  }
}

// ==================== URL 规则解析 ====================

/**
 * 解析 ESO URL 规则
 * 支持变量插值和 JSON 配置
 *
 * @param urlRule URL 规则字符串
 * @param variables 变量（如 keyword, page 等）
 * @param baseUrl 基础 URL（用于拼接相对路径）
 * @returns 解析后的 URL 配置
 */
export function parseEsoUrlRule(
  urlRule: string,
  variables?: Record<string, string>,
  baseUrl?: string
): EsoParsedUrlRule {
  let url = urlRule;
  let method: "GET" | "POST" = "GET";
  let body: string | undefined;
  let headers: Record<string, string> | undefined;
  let charset: string | undefined;

  // 检查是否有 JSON 配置（格式: url,{...}）
  const jsonConfigMatch = url.match(/^(.+?),\s*(\{[\s\S]+\})\s*$/);
  if (jsonConfigMatch) {
    url = jsonConfigMatch[1] || "";
    try {
      const config = JSON.parse(jsonConfigMatch[2] || "{}") as {
        method?: string;
        charset?: string;
        body?: string;
        headers?: Record<string, string>;
      };

      if (config.method?.toLowerCase() === "post") {
        method = "POST";
      }
      if (config.charset) {
        charset = config.charset;
      }
      if (config.body) {
        body = config.body;
      }
      if (config.headers) {
        headers = config.headers;
      }
    } catch {
      // JSON 解析失败，忽略
    }
  }

  // 替换变量 {{variable}}
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      const encodedValue = encodeURIComponent(value);
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      url = url.replace(placeholder, encodedValue);
      if (body) {
        body = body.replace(placeholder, encodedValue);
      }
    }
  }

  // 处理相对 URL
  if (baseUrl && !url.startsWith("http://") && !url.startsWith("https://")) {
    const base = baseUrl.replace(/\/+$/, "");
    const path = url.startsWith("/") ? url : "/" + url;
    url = base + path;
  }

  return {
    url: url.trim(),
    method,
    body,
    headers,
    charset,
  };
}
