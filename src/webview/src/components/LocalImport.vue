<script setup lang="ts">
/**
 * 本地书籍导入组件
 * 通过 VS Code 扩展后端读取文件，支持记住文件路径
 */
import { ref } from "vue";
import { parseTxt, parseEpub } from "@/core/local/parsers";
import { addLocalBook, addLocalBookMeta } from "@/core/local/localManager";
import type { LocalBook } from "@/core/local/types";
import { showToast } from "@/utils/toast";
import { addToShelf } from "@/core/shelf/shelfManager";
import type { BookInfo } from "@/core/source";
import { selectLocalFiles, readLocalFile } from "@/utils/vscode";

const emit = defineEmits<{
  (e: "imported"): void;
}>();

const importing = ref(false);

/**
 * 触发文件选择（通过 VS Code）
 */
async function triggerFileSelect() {
  importing.value = true;

  try {
    const files = await selectLocalFiles({
      小说文件: ["txt", "epub"],
      所有文件: ["*"],
    });

    if (files.length === 0) {
      return;
    }

    let successCount = 0;
    for (const file of files) {
      try {
        await importFileByPath(file.path, file.name);
        successCount++;
      } catch (err) {
        console.error(`[LocalImport] Failed to import ${file.name}:`, err);
        showToast(`导入失败: ${file.name}`);
      }
    }

    if (successCount > 0) {
      showToast(`成功导入 ${successCount} 本书籍`);
      emit("imported");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "导入失败";
    showToast(message);
    console.error("[LocalImport] Import failed:", err);
  } finally {
    importing.value = false;
  }
}

/**
 * 通过文件路径导入
 */
async function importFileByPath(filePath: string, fileName: string): Promise<void> {
  const fileType = fileName.toLowerCase().endsWith(".epub") ? "epub" : "txt";

  let parsed: { title: string; author?: string; chapters: any[] };

  if (fileType === "epub") {
    const base64 = await readLocalFile(filePath, "base64");
    const arrayBuffer = base64ToArrayBuffer(base64);
    parsed = await parseEpub(arrayBuffer, fileName);
  } else {
    const content = await readLocalFile(filePath, "utf8");
    parsed = parseTxt(content, fileName);
  }

  // 使用文件路径生成稳定的 ID
  const bookId = `local:${hashString(filePath)}`;

  // 创建本地书籍对象
  const localBook: LocalBook = {
    id: bookId,
    title: parsed.title,
    author: parsed.author,
    type: fileType,
    filePath: filePath,
    chapters: parsed.chapters,
    importedAt: Date.now(),
  };

  // 保存到内存
  addLocalBook(localBook);

  // 保存元数据到 localStorage（用于重启后恢复）
  addLocalBookMeta({
    id: bookId,
    filePath: filePath,
    title: parsed.title,
    author: parsed.author,
    type: fileType,
    importedAt: Date.now(),
  });

  // 同时添加到书架
  const bookInfo: BookInfo = {
    name: localBook.title,
    author: localBook.author || "未知作者",
    bookUrl: localBook.id,
    sourceId: "local",
    bookId: localBook.id,
    alternativeSources: [],
  };

  addToShelf({
    bookInfo,
    status: "reading",
    chapterIndex: 0,
    totalChapters: localBook.chapters.length,
    scrollPosition: 0,
    addedAt: Date.now(),
    lastReadAt: Date.now(),
  });
}

/**
 * Base64 转 ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 简单的字符串哈希函数
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
</script>

<template>
  <div class="rounded border border-[var(--vscode-panel-border)] p-3">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-medium">导入本地书籍</h3>
        <p class="text-xs text-[var(--vscode-descriptionForeground)]">
          支持 TXT / EPUB 格式，重启后自动恢复
        </p>
      </div>
      <button
        class="rounded bg-[var(--vscode-button-background)] px-3 py-1.5 text-xs text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
        :disabled="importing"
        @click="triggerFileSelect"
      >
        {{ importing ? "导入中..." : "选择文件" }}
      </button>
    </div>
  </div>
</template>
