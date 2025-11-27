/**
 * 书源类型定义
 * 仅支持 Legado 格式
 */

/** 书源内容类型 */
export const BookSourceType = {
  /** 小说/文字 */
  Novel: 0,
  /** 漫画/图片 */
  Comic: 1,
  /** 有声书/音频 */
  Audio: 2,
} as const;

/** 书源内容类型 */
export type BookSourceType = (typeof BookSourceType)[keyof typeof BookSourceType];

/**
 * Legado 书源格式 (阅读 App)
 */
export interface LegadoSource {
  /** 书源名称 */
  bookSourceName: string;
  /** 书源地址 */
  bookSourceUrl: string;
  /** 书源类型: 0=小说, 1=漫画, 2=有声 */
  bookSourceType: number;
  /** 书源分组 */
  bookSourceGroup?: string;
  /** 书源注释 */
  bookSourceComment?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 是否启用 CookieJar */
  enabledCookieJar?: boolean;
  /** 是否启用发现 */
  enabledExplore?: boolean;
  /** 自定义排序 */
  customOrder?: number;
  /** 权重 */
  weight?: number;
  /** 最后更新时间 */
  lastUpdateTime?: string;
  /** 响应超时 */
  respondTime?: number;

  /** 请求头 */
  header?: string;
  /** 登录 URL */
  loginUrl?: string;

  /** 搜索 URL */
  searchUrl?: string;
  /** 发现 URL */
  exploreUrl?: string;

  /** 搜索规则 */
  ruleSearch?: LegadoSearchRule;
  /** 发现规则 */
  ruleExplore?: LegadoExploreRule;
  /** 书籍信息规则 */
  ruleBookInfo?: LegadoBookInfoRule;
  /** 目录规则 */
  ruleToc?: LegadoTocRule;
  /** 正文规则 */
  ruleContent?: LegadoContentRule;
}

/** Legado 搜索规则 */
export interface LegadoSearchRule {
  bookList?: string;
  name?: string;
  author?: string;
  kind?: string;
  wordCount?: string;
  lastChapter?: string;
  intro?: string;
  coverUrl?: string;
  bookUrl?: string;
}

/** Legado 发现规则 */
export interface LegadoExploreRule extends LegadoSearchRule {}

/** Legado 书籍信息规则 */
export interface LegadoBookInfoRule {
  init?: string;
  name?: string;
  author?: string;
  kind?: string;
  wordCount?: string;
  lastChapter?: string;
  intro?: string;
  coverUrl?: string;
  tocUrl?: string;
}

/** Legado 目录规则 */
export interface LegadoTocRule {
  chapterList?: string;
  chapterName?: string;
  chapterUrl?: string;
  updateTime?: string;
  isVip?: string;
  isPay?: string;
  nextTocUrl?: string;
}

/** Legado 正文规则 */
export interface LegadoContentRule {
  content?: string;
  nextContentUrl?: string;
  replaceRegex?: string;
  imageStyle?: string;
}

/**
 * 统一的书源格式 (内部使用)
 */
export interface UnifiedSource {
  /** 唯一标识 */
  id: string;
  /** 书源名称 */
  name: string;
  /** 书源地址 */
  url: string;
  /** 书源类型 */
  type: BookSourceType;
  /** 分组 */
  group?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 原始数据 */
  raw: LegadoSource;
}

/**
 * 书籍信息
 */
export interface BookInfo {
  /** 书名 */
  name: string;
  /** 作者 */
  author?: string;
  /** 封面 URL */
  coverUrl?: string;
  /** 简介 */
  intro?: string;
  /** 分类/标签 */
  kind?: string;
  /** 字数 */
  wordCount?: string;
  /** 最新章节 */
  lastChapter?: string;
  /** 书籍详情 URL */
  bookUrl: string;
  /** 来源书源 ID */
  sourceId: string;
}

/**
 * 章节信息
 */
export interface ChapterInfo {
  /** 章节名称 */
  name: string;
  /** 章节 URL */
  url: string;
  /** 是否锁定/VIP */
  isLocked?: boolean;
  /** 更新时间 */
  updateTime?: string;
}
