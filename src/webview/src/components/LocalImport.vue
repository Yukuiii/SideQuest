<script setup lang="ts">
/**
 * 本地书籍导入组件
 */
import { ref } from "vue";
import { parseTxt, parseEpub, generateLocalBookId } from "@/core/local/parsers";
import { addLocalBook } from "@/core/local/localManager";
import type { LocalBook } from "@/core/local/types";
import { showToast } from "@/utils/toast";
import { addToShelf } from "@/core/shelf/shelfManager";
import type { BookInfo } from "@/core/source";

const emit = defineEmits<{
  (e: "imported"): void;
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const importing = ref(false);

/**
 * 触发文件选择
 */
function triggerFileSelect() {
  fileInputRef.value?.click();
}

/**
 * 处理文件选择
 */
async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  if (!files || files.length === 0) return;

  importing.value = true;

  try {
    for (const file of Array.from(files)) {
      await importFile(file);
    }
    showToast(`成功导入 ${files.length} 本书籍`);
    emit("imported");
  } catch (err) {
    const message = err instanceof Error ? err.message : "导入失败";
    showToast(message);
    console.error("[LocalImport] Import failed:", err);
  } finally {
    importing.value = false;
    // 清空 input，允许重复选择同一文件
    if (input) input.value = "";
  }
}

/**
 * 导入单个文件
 */
async function importFile(file: File): Promise<void> {
  const fileName = file.name;
  const fileType = fileName.toLowerCase().endsWith(".epub") ? "epub" : "txt";

  let parsed: { title: string; author?: string; chapters: any[] };

  if (fileType === "epub") {
    // 读取 EPUB 文件为 ArrayBuffer
    const arrayBuffer = await readFileAsArrayBuffer(file);
    // 解析 EPUB
    parsed = await parseEpub(arrayBuffer, fileName);
  } else {
    // 读取 TXT 文件为文本
    const content = await readFileAsText(file);
    // 解析 TXT
    parsed = parseTxt(content, fileName);
  }

  // 创建本地书籍对象
  const localBook: LocalBook = {
    id: generateLocalBookId(fileName),
    title: parsed.title,
    author: parsed.author,
    type: fileType,
    filePath: fileName, // 在浏览器环境中，我们只能存储文件名
    chapters: parsed.chapters,
    importedAt: Date.now(),
  };

  // 保存到本地书籍库
  addLocalBook(localBook);

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
 * 读取文件为文本
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("读取文件失败"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "UTF-8");
  });
}

/**
 * 读取文件为 ArrayBuffer
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("读取文件失败"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded border border-[var(--vscode-panel-border)] p-4">
      <h3 class="mb-2 text-sm font-medium">导入本地书籍</h3>
      <p class="mb-4 text-xs text-[var(--vscode-descriptionForeground)]">
        支持导入 TXT 和 EPUB 格式的小说文件，自动识别章节
      </p>

      <input
        ref="fileInputRef"
        type="file"
        accept=".txt,.epub"
        multiple
        class="hidden"
        @change="handleFileChange"
      />

      <button
        class="w-full rounded bg-[var(--vscode-button-background)] py-2 text-sm text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
        :disabled="importing"
        @click="triggerFileSelect"
      >
        {{ importing ? "导入中..." : "选择文件" }}
      </button>
    </div>

    <div class="rounded border border-[var(--vscode-panel-border)] p-4">
      <h4 class="mb-2 text-sm font-medium">使用说明</h4>
      <ul class="space-y-1 text-xs text-[var(--vscode-descriptionForeground)]">
        <li>• 支持 TXT 格式（UTF-8 编码）</li>
        <li>• 支持 EPUB 格式（标准 EPUB 2.0/3.0）</li>
        <li>• 自动识别章节标题和元数据</li>
        <li>• 导入后会自动添加到书架</li>
      </ul>
    </div>
  </div>
</template>
