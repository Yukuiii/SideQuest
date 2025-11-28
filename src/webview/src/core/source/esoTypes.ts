/**
 * ESO 书源类型定义
 * 基于 Any-Reader 的 ESO 规则格式
 *
 * 参考文档: https://aooiuu.github.io/any-reader/rule/
 */

/** ESO 内容类型枚举 */
export const EsoContentType = {
  /** 漫画 */
  Manga: 0,
  /** 小说 */
  Novel: 1,
  /** 视频 */
  Video: 2,
  /** 音频 */
  Audio: 3,
  /** RSS */
  RSS: 4,
  /** 小说更多 */
  NovelMore: 5,
} as const;

export type EsoContentType = (typeof EsoContentType)[keyof typeof EsoContentType];

/**
 * ESO 书源格式 (Any-Reader)
 */
export interface EsoSource {
  /** 唯一标识 (UUID) */
  id: string;
  /** 规则名称 */
  name: string;
  /** 域名，用于自动拼接非 http 开头的请求地址 */
  host: string;
  /** 内容类型: 0=漫画, 1=小说, 2=视频, 3=音频, 4=RSS, 5=小说更多 */
  contentType: EsoContentType;
  /** 排序权重，数值越高越靠前 */
  sort?: number;
  /** 规则作者 */
  author?: string;
  /** 请求头 JSON 字符串 */
  userAgent?: string;
  /** 全局 JS 脚本 */
  loadJs?: string;

  // ========== 搜索流程 ==========
  /** 启用搜索功能 */
  enableSearch?: boolean;
  /** 搜索请求地址 */
  searchUrl?: string;
  /** 搜索结果列表规则 */
  searchList?: string;
  /** 书籍/视频标题规则 */
  searchName?: string;
  /** 作者信息规则 */
  searchAuthor?: string;
  /** 封面 URL 规则 */
  searchCover?: string;
  /** 最新章节规则 */
  searchChapter?: string;
  /** 描述文本规则 */
  searchDescription?: string;
  /** 搜索结果传递给下一流程的数据规则 */
  searchResult?: string;

  // ========== 章节列表流程 ==========
  /** 章节列表请求地址 */
  chapterUrl?: string;
  /** 章节列表规则 */
  chapterList?: string;
  /** 章节标题规则 */
  chapterName?: string;
  /** 章节封面规则 */
  chapterCover?: string;
  /** 发布时间规则 */
  chapterTime?: string;
  /** 章节列表下一页 URL 规则 */
  chapterNextUrl?: string;
  /** 章节结果传递给正文流程的数据规则 */
  chapterResult?: string;

  // ========== 发现页流程 ==========
  /** 启用发现页功能 */
  enableDiscover?: boolean;
  /** 发现页分类配置 */
  discoverUrl?: string;
  /** 发现页列表规则 */
  discoverList?: string;
  /** 发现页标题规则 */
  discoverName?: string;
  /** 发现页封面规则 */
  discoverCover?: string;
  /** 发现页作者规则 */
  discoverAuthor?: string;
  /** 发现页描述规则 */
  discoverDescription?: string;
  /** 发现页结果规则 */
  discoverResult?: string;
  /** 发现页标签规则 */
  discoverTags?: string;
  /** 发现页章节信息规则 */
  discoverChapter?: string;
  /** 发现页下一页 URL 规则 */
  discoverNextUrl?: string;

  // ========== 正文流程 ==========
  /** 正文请求地址 */
  contentUrl?: string;
  /** 正文内容规则 */
  contentItems?: string;
  /** 多页正文的下一页地址规则 */
  contentNextUrl?: string;
  /** 图片解密脚本 */
  contentDecoder?: string;
}

/**
 * ESO 规则解析结果类型
 */
export interface EsoParsedRule {
  /** 规则类型 */
  type: "css" | "xpath" | "json" | "js" | "filter" | "replace" | "raw";
  /** 选择器或表达式 */
  selector: string;
  /** 属性提取器 (CSS 专用) */
  attr?: string;
  /** 正则表达式 */
  regex?: string;
  /** 正则替换文本 */
  replacement?: string;
  /** JavaScript 代码 */
  jsCode?: string;
  /** 子规则（用于组合规则） */
  subRules?: EsoParsedRule[];
  /** 组合方式 */
  combinator?: "or" | "and";
}

/**
 * 解析后的 ESO URL 规则
 */
export interface EsoParsedUrlRule {
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
