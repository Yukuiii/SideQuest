/**
 * Legado 规则解析引擎
 * 专门用于解析 Legado 书源的规则语法
 *
 * 规则语法说明：
 * - CSS 选择器: div.class, #id, tag
 * - Legado 索引语法: tag.index (如 span.1 表示第2个span), tag.-1 (最后一个)
 * - 链式选择器: selector@selector@attr
 * - @text: 获取文本内容
 * - @html: 获取 HTML 内容
 * - @href: 获取链接地址
 * - @src: 获取图片地址
 * - @attr/属性名: 获取指定属性
 * - ##正则: 正则匹配
 * - {{js代码}}: JavaScript 执行
 * - || 或 &&: 组合规则
 */

/** 规则解析结果类型 */
export interface ParsedRule {
  /** 规则类型 */
  type: "css" | "xpath" | "json" | "regex" | "js";
  /** CSS 选择器或表达式 */
  selector: string;
  /** 属性提取器 */
  attr?: string;
  /** 正则表达式 */
  regex?: string;
  /** 正则替换 */
  replacement?: string;
  /** JavaScript 代码 */
  jsCode?: string;
  /** 子规则（用于组合规则） */
  subRules?: ParsedRule[];
  /** 组合方式 */
  combinator?: "or" | "and";
}

/**
 * 解析规则字符串
 * @param rule 规则字符串
 * @returns 解析后的规则对象
 */
export function parseRule(rule: string): ParsedRule {
  if (!rule || typeof rule !== "string") {
    return { type: "css", selector: "" };
  }

  const trimmedRule = rule.trim();

  // 检查组合规则
  if (trimmedRule.includes("||")) {
    return {
      type: "css",
      selector: "",
      combinator: "or",
      subRules: trimmedRule.split("||").map((r) => parseRule(r.trim())),
    };
  }

  if (trimmedRule.includes("&&")) {
    return {
      type: "css",
      selector: "",
      combinator: "and",
      subRules: trimmedRule.split("&&").map((r) => parseRule(r.trim())),
    };
  }

  // 检查 JavaScript 代码
  const jsMatch = trimmedRule.match(/\{\{(.+?)\}\}/s);
  if (jsMatch) {
    return {
      type: "js",
      selector: "",
      jsCode: jsMatch[1],
    };
  }

  // 检查 JSONPath
  if (trimmedRule.startsWith("$.") || trimmedRule.startsWith("$[")) {
    return {
      type: "json",
      selector: trimmedRule,
    };
  }

  // 检查 XPath
  if (trimmedRule.startsWith("//") || trimmedRule.startsWith("@xpath:")) {
    return {
      type: "xpath",
      selector: trimmedRule.replace(/^@xpath:/, ""),
    };
  }

  // Legado 链式语法: selector@selector@attr##regex##replacement
  // 例如: span.1@a@text##正则
  let remaining = trimmedRule;
  let regex: string | undefined;
  let replacement: string | undefined;

  // 处理正则 ##
  const regexMatch = remaining.match(/##(.+?)(?:##(.*))?$/);
  if (regexMatch) {
    regex = regexMatch[1];
    replacement = regexMatch[2];
    remaining = remaining.slice(0, remaining.indexOf("##"));
  }

  // 按 @ 分割，解析 Legado 链式选择器
  const parts = remaining.split("@");
  const selectors: string[] = [];
  let attr: string | undefined;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]?.trim();
    if (!part) continue;

    // 最后一个可能是属性
    if (i === parts.length - 1) {
      const lowerPart = part.toLowerCase();
      if (["text", "html", "href", "src", "textNodes", "ownText"].includes(lowerPart) ||
          lowerPart.startsWith("attr/")) {
        attr = part;
        continue;
      }
    }

    selectors.push(part);
  }

  return {
    type: "css",
    selector: selectors.join("@"), // 保留链式选择器供后续解析
    attr,
    regex,
    replacement,
  };
}

/**
 * 执行规则提取
 * @param element DOM 元素或字符串
 * @param rule 解析后的规则
 * @param context 上下文（用于 JS 执行）
 * @returns 提取结果
 */
export function executeRule(
  element: Element | string | null,
  rule: ParsedRule,
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
        const result = executeRule(element, subRule, context);
        if (result && (typeof result === "string" ? result.length > 0 : result.length > 0)) {
          return result;
        }
      }
      return null;
    } else {
      // AND: 连接所有结果
      const results: string[] = [];
      for (const subRule of rule.subRules) {
        const result = executeRule(element, subRule, context);
        if (result) {
          if (Array.isArray(result)) {
            results.push(...result);
          } else {
            results.push(result);
          }
        }
      }
      return results.length > 0 ? results.join("") : null;
    }
  }

  // 处理 JavaScript
  if (rule.type === "js" && rule.jsCode) {
    return executeJsRule(rule.jsCode, element, context);
  }

  // 处理字符串输入
  if (typeof element === "string") {
    return applyRegex(element, rule.regex, rule.replacement);
  }

  // 解析 Legado 链式选择器
  let targetElement: Element | null = element;
  if (rule.selector) {
    targetElement = queryLegadoSelector(element, rule.selector);
  }

  if (!targetElement) {
    return null;
  }

  // 提取属性
  let value = extractAttribute(targetElement, rule.attr);

  // 应用正则
  if (value && rule.regex) {
    value = applyRegex(value, rule.regex, rule.replacement);
  }

  return value;
}

/**
 * 解析 Legado 选择器语法
 * 支持: tag.index (如 span.1 表示第2个span)
 *       tag.-1 (最后一个)
 *       tag:index (同上)
 *       tag class (标准 CSS)
 * @param element 根元素
 * @param selector Legado 选择器字符串
 * @returns 匹配的元素
 */
function queryLegadoSelector(element: Element, selector: string): Element | null {
  // 按 @ 分割链式选择器
  const parts = selector.split("@");
  let current: Element | null = element;

  for (const part of parts) {
    if (!current || !part.trim()) continue;

    current = querySingleLegadoSelector(current, part.trim());
  }

  return current;
}

/**
 * 解析单个 Legado 选择器
 */
function querySingleLegadoSelector(element: Element, selector: string): Element | null {
  // 检查是否是 Legado 索引语法: tag.index 或 tag:index 或 tag.-1
  const indexMatch = selector.match(/^([a-zA-Z][\w-]*)[.:](-?\d+)$/);
  if (indexMatch) {
    const tag = indexMatch[1];
    const indexStr = indexMatch[2];
    if (!tag || !indexStr) return null;

    const index = parseInt(indexStr, 10);
    const elements = element.querySelectorAll(tag);

    if (elements.length === 0) return null;

    // 负数索引从末尾开始
    const actualIndex = index < 0 ? elements.length + index : index;
    return elements[actualIndex] || null;
  }

  // 检查是否是范围语法: tag.start:end
  const rangeMatch = selector.match(/^([a-zA-Z][\w-]*)\.(\d+):(\d+)$/);
  if (rangeMatch) {
    const tag = rangeMatch[1];
    const startStr = rangeMatch[2];
    if (!tag || !startStr) return null;

    const start = parseInt(startStr, 10);
    const elements = element.querySelectorAll(tag);
    return elements[start] || null;
  }

  // 检查 class 选择器简写: .classname
  if (selector.startsWith(".") && !selector.includes(" ")) {
    return element.querySelector(selector);
  }

  // 检查 ID 选择器: #id
  if (selector.startsWith("#")) {
    return element.querySelector(selector);
  }

  // 尝试作为标准 CSS 选择器
  try {
    return element.querySelector(selector);
  } catch {
    // 如果 CSS 选择器无效，尝试作为标签名
    const elements = element.getElementsByTagName(selector);
    return elements[0] || null;
  }
}

/**
 * 执行规则提取（返回数组）
 * @param element DOM 元素
 * @param rule 解析后的规则
 * @param context 上下文
 * @returns 提取结果数组
 */
export function executeRuleAll(
  element: Element | null,
  rule: ParsedRule,
  _context?: Record<string, unknown>
): string[] {
  if (!element || !rule.selector) {
    return [];
  }

  const elements = element.querySelectorAll(rule.selector);
  const results: string[] = [];

  elements.forEach((el) => {
    let value = extractAttribute(el, rule.attr);

    if (value && rule.regex) {
      value = applyRegex(value, rule.regex, rule.replacement);
    }

    if (value) {
      results.push(value);
    }
  });

  return results;
}

/**
 * 从元素提取属性值
 * @param element DOM 元素
 * @param attr 属性名
 * @returns 属性值
 */
function extractAttribute(element: Element, attr?: string): string | null {
  if (!attr) {
    return element.textContent?.trim() || null;
  }

  const attrLower = attr.toLowerCase();

  switch (attrLower) {
    case "text":
      return element.textContent?.trim() || null;
    case "html":
      return element.innerHTML;
    case "href":
      return element.getAttribute("href");
    case "src":
      return element.getAttribute("src");
    default:
      // @attr/属性名 格式
      if (attrLower.startsWith("attr/")) {
        const attrName = attr.slice(5);
        return element.getAttribute(attrName);
      }
      return element.getAttribute(attr);
  }
}

/**
 * 应用正则表达式
 * Legado 规则中 ##正则 的含义：
 * - ##正则##替换: 替换模式，将匹配内容替换为指定字符串
 * - ##正则: 删除模式，将匹配内容删除（替换为空）
 *
 * @param value 输入值
 * @param regex 正则表达式
 * @param replacement 替换字符串
 * @returns 处理后的值
 */
function applyRegex(value: string, regex?: string, replacement?: string): string | null {
  if (!regex) {
    return value;
  }

  try {
    const re = new RegExp(regex, "g");
    // Legado 规则：无论是否指定 replacement，都是替换模式
    // 没有 replacement 时默认替换为空字符串（即删除）
    const result = value.replace(re, replacement ?? "");
    return result.trim() || null;
  } catch {
    return value;
  }
}

/**
 * 执行 JavaScript 规则
 * @param code JavaScript 代码
 * @param element 当前元素
 * @param context 上下文
 * @returns 执行结果
 */
function executeJsRule(
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

    return result != null ? String(result) : null;
  } catch (error) {
    console.error("JS 规则执行失败:", error);
    return null;
  }
}

/**
 * 解析并执行规则（便捷方法）
 * @param element DOM 元素或字符串
 * @param ruleString 规则字符串
 * @param context 上下文
 * @returns 提取结果
 */
export function parseAndExecute(
  element: Element | string | null,
  ruleString: string,
  context?: Record<string, unknown>
): string | string[] | null {
  const rule = parseRule(ruleString);
  return executeRule(element, rule, context);
}

/**
 * 解析 URL 规则
 * URL 规则可能包含 POST 数据和编码设置
 * 格式: url,{"key":"searchKey"} 或 url@header{...}
 * @param urlRule URL 规则字符串
 * @returns 解析后的 URL 配置
 */
export interface ParsedUrlRule {
  /** 基础 URL */
  url: string;
  /** HTTP 方法 */
  method: "GET" | "POST";
  /** POST 数据 */
  body?: string;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 字符编码 */
  charset?: string;
}

/**
 * 解析 URL 规则
 * @param urlRule URL 规则字符串
 * @param searchKey 搜索关键词（用于替换占位符）
 * @param baseUrl 基础 URL（用于拼接相对路径）
 * @returns 解析后的 URL 配置
 */
export function parseUrlRule(urlRule: string, searchKey?: string, baseUrl?: string): ParsedUrlRule {
  let url = urlRule;
  let method: "GET" | "POST" = "GET";
  let body: string | undefined;
  let headers: Record<string, string> | undefined;
  let charset: string | undefined;

  // 替换搜索关键词占位符（支持多种 Legado 模板语法）
  if (searchKey) {
    const encodedKey = encodeURIComponent(searchKey);
    // {{key}} 格式
    url = url.replace(/\{\{key\}\}/g, encodedKey);
    // {{encodeURIComponent(key)}} 格式
    url = url.replace(/\{\{encodeURIComponent\(key\)\}\}/g, encodedKey);
    // {{java.encodeURI(key)}} 格式
    url = url.replace(/\{\{java\.encodeURI\(key\)\}\}/g, encodedKey);
    // searchKey 变量
    url = url.replace(/searchKey/g, encodedKey);
    // $key 格式
    url = url.replace(/\$key/g, encodedKey);
  }

  // 处理相对 URL
  if (baseUrl && !url.startsWith("http://") && !url.startsWith("https://")) {
    // 移除 baseUrl 末尾的斜杠
    const base = baseUrl.replace(/\/+$/, "");
    // 确保相对路径以 / 开头
    const path = url.startsWith("/") ? url : "/" + url;
    url = base + path;
  }

  // 检查是否有 POST 数据
  const postMatch = url.match(/,\s*(\{.+\})\s*$/);
  if (postMatch) {
    method = "POST";
    try {
      body = postMatch[1];
      url = url.slice(0, url.indexOf(postMatch[0]));
    } catch {
      // 保持原样
    }
  }

  // 检查请求头
  const headerMatch = url.match(/@header(\{.+?\})/);
  if (headerMatch && headerMatch[1]) {
    try {
      headers = JSON.parse(headerMatch[1]);
      url = url.replace(headerMatch[0], "");
    } catch {
      // 保持原样
    }
  }

  // 检查字符编码
  const charsetMatch = url.match(/@charset=(\w+)/);
  if (charsetMatch) {
    charset = charsetMatch[1];
    url = url.replace(charsetMatch[0], "");
  }

  return {
    url: url.trim(),
    method,
    body,
    headers,
    charset,
  };
}
