/**
 * 本地书籍模块导出
 */

export type { LocalBook, LocalChapter, LocalBookData } from "./types";
export {
  loadLocalBooks,
  addLocalBook,
  removeLocalBook,
  getLocalBook,
  getLocalBookAsync,
  getAllLocalBooks,
  loadLocalBooksMeta,
  saveLocalBooksMeta,
  addLocalBookMeta,
  removeLocalBookMeta,
} from "./localManager";
export { parseTxt, parseEpub, generateLocalBookId } from "./parsers";
export { createLocalSource, getLocalChapters, getLocalContent } from "./localSource";
