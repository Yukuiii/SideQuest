/**
 * 本地书籍类型定义
 */

export interface LocalBook {
  /** 唯一标识 */
  id: string;
  /** 书名 */
  title: string;
  /** 作者 */
  author?: string;
  /** 文件类型 */
  type: "epub" | "txt";
  /** 文件路径（相对于工作区） */
  filePath: string;
  /** 章节列表 */
  chapters: LocalChapter[];
  /** 导入时间 */
  importedAt: number;
}

export interface LocalChapter {
  /** 章节标题 */
  title: string;
  /** 章节内容 */
  content: string;
  /** 章节索引 */
  index: number;
}

export interface LocalBookData {
  books: LocalBook[];
}
