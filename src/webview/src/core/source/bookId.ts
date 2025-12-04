/**
 * 生成书籍唯一 ID（基于书名与作者）
 */
export function generateBookId(name: string, author?: string): string {
  const normalized = `${(name || "").trim().toLowerCase()}|${(author || "").trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0; // 转为 32 位整数
  }
  return `book_${Math.abs(hash).toString(36)}`;
}
