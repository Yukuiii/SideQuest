/**
 * Legado 规则解析引擎
 * 专门用于解析 Legado 书源的规则语法
 *
 * 规则语法说明（参考 https://mgz0227.github.io/The-tutorial-of-Legado/Rule/source.html）：
 *
 * 一、JSOUP Default 语法（@ 分隔符）
 * - class.classname.index: 按 class 选择，如 class.odd.0
 * - tag.tagname.index: 按标签选择，如 tag.a.0
 * - id.idname: 按 ID 选择，如 id.content
 * - text.内容: 按文本内容匹配
 * - children.index: 获取子元素
 * - .classname.index: class 的简写形式
 *
 * 二、索引和位置
 * - 正数从 0 开始，0 是第一个
 * - 负数从末尾开始，-1 是最后一个
 * - 不加索引获取所有匹配元素
 * - [0,2,4]: 获取指定位置
 * - [!0,2]: 排除指定位置
 * - [0:5]: 区间（左闭右开）
 * - [0:10:2]: 带步长的区间
 *
 * 三、属性获取（@ 最后一段）
 * - @text: 获取文本内容
 * - @textNodes: 获取所有文本节点
 * - @ownText: 仅获取直接文本
 * - @html: 获取 HTML 内容
 * - @href: 获取链接地址
 * - @src: 获取图片地址
 * - @attr/属性名: 获取指定属性
 *
 * 四、特殊语法
 * - ##正则##替换: 正则替换
 * - -selector: 列表反序
 * - @css:: 标准 CSS 选择器
 * - @json: 或 $.: JSONPath
 * - @XPath: 或 //: XPath
 * - || 或 &&: 组合规则
 * - {{js代码}}: JavaScript 执行
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

  // 检查 JSONPath（支持 @json: 前缀）
  if (trimmedRule.startsWith("@json:")) {
    return {
      type: "json",
      selector: trimmedRule.slice(6).trim(),
    };
  }
  if (trimmedRule.startsWith("$.") || trimmedRule.startsWith("$[")) {
    return {
      type: "json",
      selector: trimmedRule,
    };
  }

  // 检查 XPath（支持 @XPath: 前缀，不区分大小写）
  if (trimmedRule.startsWith("//") || trimmedRule.toLowerCase().startsWith("@xpath:")) {
    return {
      type: "xpath",
      selector: trimmedRule.replace(/^@xpath:/i, ""),
    };
  }

  // 检查 @css: 前缀（标准 CSS 选择器）
  // 注意：这里只做标记，实际处理在 queryLegadoSelectorAll 中

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
 * 支持完整的 Legado JSOUP Default 语法
 * @param element 根元素
 * @param selector Legado 选择器字符串
 * @returns 匹配的元素
 */
function queryLegadoSelector(element: Element, selector: string): Element | null {
  const elements = queryLegadoSelectorAll(element, selector);
  return elements[0] || null;
}

/**
 * 解析 Legado 选择器语法（返回所有匹配元素）
 * @param element 根元素
 * @param selector Legado 选择器字符串
 * @returns 匹配的元素数组
 */
export function queryLegadoSelectorAll(element: Element, selector: string): Element[] {
  // 检查列表反序前缀
  let reverse = false;
  let selectorToProcess = selector;
  if (selector.startsWith("-")) {
    reverse = true;
    selectorToProcess = selector.slice(1);
  }

  // 检查 @css: 前缀，使用标准 CSS 选择器
  if (selectorToProcess.startsWith("@css:")) {
    const cssSelector = selectorToProcess.slice(5).trim();
    try {
      const elements = Array.from(element.querySelectorAll(cssSelector));
      return reverse ? elements.reverse() : elements;
    } catch {
      return [];
    }
  }

  // 按 @ 分割链式选择器
  const parts = selectorToProcess.split("@");
  let currentElements: Element[] = [element];

  for (const part of parts) {
    if (!part.trim()) continue;

    const nextElements: Element[] = [];
    for (const el of currentElements) {
      const matched = querySingleLegadoSelectorAll(el, part.trim());
      nextElements.push(...matched);
    }
    currentElements = nextElements;

    if (currentElements.length === 0) break;
  }

  return reverse ? currentElements.reverse() : currentElements;
}

/**
 * 解析单个 Legado 选择器（返回所有匹配元素）
 * 支持完整的 Legado 语法：
 * - class.classname.index
 * - tag.tagname.index
 * - id.idname
 * - text.内容
 * - children.index
 * - .classname.index (class 简写)
 * - 数组索引 [0,1,2] 或 [0:5:2]
 * - 排除语法 [!0,1]
 */
function querySingleLegadoSelectorAll(element: Element, selector: string): Element[] {
  // 1. 检查 class.classname.index 格式
  const classMatch = selector.match(/^class\.([^.[\]]+)(?:\.(-?\d+))?(?:\[(.+?)\])?$/i);
  if (classMatch) {
    const className = classMatch[1];
    const indexStr = classMatch[2];
    const arrayIndex = classMatch[3];

    if (!className) return [];
    const elements = Array.from(element.querySelectorAll(`.${className}`));
    return applyIndexSelector(elements, indexStr, arrayIndex);
  }

  // 2. 检查 id.idname 格式
  const idMatch = selector.match(/^id\.([^.[\]]+)$/i);
  if (idMatch) {
    const idName = idMatch[1];
    if (!idName) return [];
    const el = element.querySelector(`#${idName}`);
    return el ? [el] : [];
  }

  // 3. 检查 tag.tagname.index 格式
  const tagMatch = selector.match(/^tag\.([a-zA-Z][\w-]*)(?:\.(-?\d+))?(?:\[(.+?)\])?$/i);
  if (tagMatch) {
    const tagName = tagMatch[1];
    const indexStr = tagMatch[2];
    const arrayIndex = tagMatch[3];

    if (!tagName) return [];
    const elements = Array.from(element.querySelectorAll(tagName));
    return applyIndexSelector(elements, indexStr, arrayIndex);
  }

  // 4. 检查 text.内容 格式（按文本内容匹配）
  const textMatch = selector.match(/^text\.(.+)$/i);
  if (textMatch) {
    const textContent = textMatch[1];
    if (!textContent) return [];
    // 查找包含指定文本的元素
    const allElements = Array.from(element.querySelectorAll("*"));
    return allElements.filter(el => el.textContent?.includes(textContent));
  }

  // 5. 检查 children.index 格式
  const childrenMatch = selector.match(/^children(?:\.(-?\d+))?(?:\[(.+?)\])?$/i);
  if (childrenMatch) {
    const indexStr = childrenMatch[1];
    const arrayIndex = childrenMatch[2];
    const children = Array.from(element.children);
    return applyIndexSelector(children, indexStr, arrayIndex);
  }

  // 6. 检查 .classname.index 简写格式（Legado 特有）
  const classShortMatch = selector.match(/^\.([^.[\]]+)(?:\.(-?\d+))?(?:\[(.+?)\])?$/);
  if (classShortMatch) {
    const className = classShortMatch[1];
    const indexStr = classShortMatch[2];
    const arrayIndex = classShortMatch[3];

    if (!className) return [];
    const elements = Array.from(element.querySelectorAll(`.${className}`));
    return applyIndexSelector(elements, indexStr, arrayIndex);
  }

  // 7. 检查 #id 格式
  if (selector.startsWith("#")) {
    const el = element.querySelector(selector);
    return el ? [el] : [];
  }

  // 8. 检查纯标签名.index 格式（如 a.0, li.-1）
  const simpleTagMatch = selector.match(/^([a-zA-Z][\w-]*)(?:\.(-?\d+))?(?:\[(.+?)\])?$/);
  if (simpleTagMatch) {
    const tagName = simpleTagMatch[1];
    const indexStr = simpleTagMatch[2];
    const arrayIndex = simpleTagMatch[3];

    if (!tagName) return [];

    // 检查是否是有效的 HTML 标签名
    const validTags = [
      "a", "abbr", "address", "article", "aside", "audio", "b", "blockquote", "body",
      "br", "button", "canvas", "caption", "cite", "code", "col", "colgroup", "data",
      "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em",
      "embed", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3",
      "h4", "h5", "h6", "head", "header", "hr", "html", "i", "iframe", "img", "input",
      "ins", "kbd", "label", "legend", "li", "link", "main", "map", "mark", "meta",
      "meter", "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p",
      "param", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp",
      "script", "section", "select", "small", "source", "span", "strong", "style",
      "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot",
      "th", "thead", "time", "title", "tr", "track", "u", "ul", "var", "video", "wbr"
    ];

    if (validTags.includes(tagName.toLowerCase()) || indexStr !== undefined || arrayIndex !== undefined) {
      const elements = Array.from(element.querySelectorAll(tagName));
      return applyIndexSelector(elements, indexStr, arrayIndex);
    }
  }

  // 9. 尝试作为标准 CSS 选择器
  try {
    return Array.from(element.querySelectorAll(selector));
  } catch {
    // 如果 CSS 选择器无效，尝试作为标签名
    try {
      return Array.from(element.getElementsByTagName(selector));
    } catch {
      return [];
    }
  }
}

/**
 * 应用索引选择器
 * 支持：单个索引、数组索引 [0,1,2]、区间 [0:5:2]、排除 [!0,1]
 * @param elements 元素数组
 * @param indexStr 单个索引字符串
 * @param arrayIndex 数组/区间索引字符串
 * @returns 筛选后的元素数组
 */
function applyIndexSelector(
  elements: Element[],
  indexStr?: string,
  arrayIndex?: string
): Element[] {
  if (elements.length === 0) return [];

  // 优先处理数组索引
  if (arrayIndex) {
    return applyArrayIndex(elements, arrayIndex);
  }

  // 处理单个索引
  if (indexStr !== undefined) {
    const index = parseInt(indexStr, 10);
    const actualIndex = index < 0 ? elements.length + index : index;
    const el = elements[actualIndex];
    return el ? [el] : [];
  }

  // 无索引返回所有元素
  return elements;
}

/**
 * 应用数组索引
 * 格式：
 * - [0,2,4]: 获取第 0、2、4 个
 * - [!0,2]: 排除第 0、2 个
 * - [0:5]: 区间（左闭右开）
 * - [0:10:2]: 带步长的区间
 * @param elements 元素数组
 * @param indexExpr 索引表达式
 * @returns 筛选后的元素数组
 */
function applyArrayIndex(elements: Element[], indexExpr: string): Element[] {
  const len = elements.length;
  if (len === 0) return [];

  // 检查是否是排除模式
  const isExclude = indexExpr.startsWith("!");
  const expr = isExclude ? indexExpr.slice(1) : indexExpr;

  // 检查是否是区间格式 [start:end:step]
  if (expr.includes(":")) {
    const parts = expr.split(":").map(p => p.trim());
    let start = parts[0] ? parseInt(parts[0], 10) : 0;
    let end = parts[1] ? parseInt(parts[1], 10) : len;
    const step = parts[2] ? parseInt(parts[2], 10) : 1;

    // 处理负数索引
    if (start < 0) start = len + start;
    if (end < 0) end = len + end;

    // 确保范围有效
    start = Math.max(0, Math.min(start, len));
    end = Math.max(0, Math.min(end, len));

    const indices: number[] = [];
    if (step > 0) {
      for (let i = start; i < end; i += step) {
        indices.push(i);
      }
    } else if (step < 0) {
      for (let i = start; i > end; i += step) {
        indices.push(i);
      }
    }

    if (isExclude) {
      const excludeSet = new Set(indices);
      return elements.filter((_, i) => !excludeSet.has(i));
    }
    return indices.map(i => elements[i]).filter((el): el is Element => el !== undefined);
  }

  // 逗号分隔的索引列表 [0,2,4]
  const indices = expr.split(",").map(s => {
    const idx = parseInt(s.trim(), 10);
    return idx < 0 ? len + idx : idx;
  });

  if (isExclude) {
    const excludeSet = new Set(indices);
    return elements.filter((_, i) => !excludeSet.has(i));
  }
  return indices.map(i => elements[i]).filter((el): el is Element => el !== undefined);
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

  // 使用 Legado 选择器解析
  const elements = queryLegadoSelectorAll(element, rule.selector);
  const results: string[] = [];

  for (const el of elements) {
    let value = extractAttribute(el, rule.attr);

    if (value && rule.regex) {
      value = applyRegex(value, rule.regex, rule.replacement);
    }

    if (value) {
      results.push(value);
    }
  }

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

    return result !== null && result !== undefined ? String(result) : null;
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
 * 支持 Legado 的复杂 URL 格式：
 * - 简单格式: /search?key={{key}}
 * - JSON 配置格式: /search,{"charset":"utf-8","method":"post","body":"keyword={{key}}"}
 * - 请求头格式: url@header{"User-Agent":"..."}
 * - 编码格式: url@charset=gbk
 *
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

      // 解析 method
      if (config.method?.toLowerCase() === "post") {
        method = "POST";
      }

      // 解析 charset
      if (config.charset) {
        charset = config.charset;
      }

      // 解析 body
      if (config.body) {
        body = config.body;
      }

      // 解析 headers
      if (config.headers) {
        headers = config.headers;
      }

      console.log("[parseUrlRule] 解析 JSON 配置:", { url, method, charset, body, headers });
    } catch (e) {
      console.error("[parseUrlRule] JSON 配置解析失败:", e);
    }
  }

  // 替换搜索关键词占位符（支持多种 Legado 模板语法）
  if (searchKey) {
    const encodedKey = encodeURIComponent(searchKey);

    // 替换 URL 中的占位符
    url = replaceKeyPlaceholders(url, searchKey, encodedKey);

    // 替换 body 中的占位符
    if (body) {
      body = replaceKeyPlaceholders(body, searchKey, encodedKey);
    }
  }

  // 处理相对 URL（在替换占位符之后）
  if (baseUrl && !url.startsWith("http://") && !url.startsWith("https://")) {
    // 移除 baseUrl 末尾的斜杠
    const base = baseUrl.replace(/\/+$/, "");
    // 确保相对路径以 / 开头
    const path = url.startsWith("/") ? url : "/" + url;
    url = base + path;
  }

  // 检查请求头（旧格式: @header{...}）
  const headerMatch = url.match(/@header(\{.+?\})/);
  if (headerMatch && headerMatch[1]) {
    try {
      headers = { ...headers, ...JSON.parse(headerMatch[1]) };
      url = url.replace(headerMatch[0], "");
    } catch {
      // 保持原样
    }
  }

  // 检查字符编码（旧格式: @charset=xxx）
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

/**
 * 替换搜索关键词占位符
 * @param str 待替换的字符串
 * @param rawKey 原始关键词
 * @param encodedKey URL 编码后的关键词
 * @returns 替换后的字符串
 */
function replaceKeyPlaceholders(str: string, rawKey: string, encodedKey: string): string {
  return str
    // {{key}} 格式 - 使用编码后的关键词
    .replace(/\{\{key\}\}/g, encodedKey)
    // {{encodeURIComponent(key)}} 格式
    .replace(/\{\{encodeURIComponent\(key\)\}\}/g, encodedKey)
    // {{java.encodeURI(key)}} 格式
    .replace(/\{\{java\.encodeURI\(key\)\}\}/g, encodedKey)
    // searchKey 变量
    .replace(/searchKey/g, encodedKey)
    // $key 格式
    .replace(/\$key/g, encodedKey)
    // keyword={{key}} 中的 {{key}} 可能需要原始值（在 body 中）
    .replace(/\{\{key\}\}/g, rawKey);
}
