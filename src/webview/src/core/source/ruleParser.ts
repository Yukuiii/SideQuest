/**
 * 规则解析引擎
 * 支持 Legado 的 CSS 选择器 + @ 语法
 *
 * 规则语法说明：
 * - CSS 选择器: div.class, #id, tag
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

  // CSS 选择器 + @ 语法
  let selector = trimmedRule;
  let attr: string | undefined;
  let regex: string | undefined;
  let replacement: string | undefined;

  // 处理正则 ##
  const regexMatch = selector.match(/##(.+?)(?:##(.*))?$/);
  if (regexMatch) {
    regex = regexMatch[1];
    replacement = regexMatch[2];
    selector = selector.slice(0, selector.indexOf("##"));
  }

  // 处理属性 @
  const attrMatch = selector.match(/@(text|html|href|src|attr\/[\w-]+)$/i);
  if (attrMatch) {
    attr = attrMatch[1];
    selector = selector.slice(0, selector.lastIndexOf("@"));
  }

  return {
    type: "css",
    selector: selector.trim(),
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

  // CSS 选择器
  let targetElement: Element | null = element;
  if (rule.selector) {
    targetElement = element.querySelector(rule.selector);
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
    const re = new RegExp(regex);
    const match = value.match(re);

    if (replacement !== undefined) {
      // 替换模式
      return value.replace(re, replacement);
    }

    // 匹配模式：返回第一个捕获组或整个匹配
    if (match) {
      return match[1] || match[0];
    }

    return null;
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
 * @returns 解析后的 URL 配置
 */
export function parseUrlRule(urlRule: string, searchKey?: string): ParsedUrlRule {
  let url = urlRule;
  let method: "GET" | "POST" = "GET";
  let body: string | undefined;
  let headers: Record<string, string> | undefined;
  let charset: string | undefined;

  // 替换搜索关键词占位符
  if (searchKey) {
    url = url.replace(/\{\{key\}\}/g, encodeURIComponent(searchKey));
    url = url.replace(/searchKey/g, encodeURIComponent(searchKey));
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
