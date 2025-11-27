<script setup lang="ts">
/**
 * 书籍列表组件
 * 展示搜索到的书籍或本地收藏的书籍
 */
import { ref, computed } from "vue";
import type { BookInfo, UnifiedSource } from "../core/source";
import { sourceManager, searchBooks } from "../core/source";

const emit = defineEmits<{
  (e: "select", book: BookInfo): void;
}>();

/** 已导入的书源列表 */
const sources = ref<UnifiedSource[]>([]);
/** 当前选中的书源 */
const selectedSourceId = ref<string>("");
/** 搜索关键词 */
const keyword = ref("");
/** 搜索结果 */
const books = ref<BookInfo[]>([]);
/** 是否正在搜索 */
const searching = ref(false);
/** 错误消息 */
const error = ref("");

/** 当前选中的书源 */
const selectedSource = computed(() => {
  return sources.value.find((s) => s.id === selectedSourceId.value);
});

/**
 * 刷新书源列表
 */
function refreshSources() {
  sources.value = sourceManager.getAll();
  const firstSource = sources.value[0];
  if (firstSource && !selectedSourceId.value) {
    selectedSourceId.value = firstSource.id;
  }
}

/**
 * 搜索书籍
 */
async function handleSearch() {
  if (!selectedSource.value) {
    error.value = "请先选择书源";
    return;
  }

  if (!keyword.value.trim()) {
    error.value = "请输入搜索关键词";
    return;
  }

  searching.value = true;
  error.value = "";
  books.value = [];

  try {
    const results = await searchBooks(selectedSource.value, keyword.value.trim());
    books.value = results;

    if (results.length === 0) {
      error.value = "未找到相关书籍";
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "搜索失败";
  } finally {
    searching.value = false;
  }
}

/**
 * 选择书籍
 */
function selectBook(book: BookInfo) {
  emit("select", book);
}

// 初始化时加载书源
refreshSources();

// 监听书源变更
sourceManager.onChange(() => {
  refreshSources();
});

// 暴露刷新方法
defineExpose({ refreshSources });
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 书源选择 -->
    <div class="flex flex-col gap-1">
      <label class="text-xs text-[var(--vscode-descriptionForeground)]">选择书源</label>
      <select
        v-model="selectedSourceId"
        class="w-full rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] p-1.5 text-sm text-[var(--vscode-input-foreground)]"
      >
        <option value="" disabled>请选择书源</option>
        <option v-for="source in sources" :key="source.id" :value="source.id">
          {{ source.name }}
        </option>
      </select>
    </div>

    <!-- 搜索框 -->
    <div class="flex gap-2">
      <input
        v-model="keyword"
        type="text"
        class="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-sm text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)] focus:border-[var(--vscode-focusBorder)] focus:outline-none"
        placeholder="输入书名搜索..."
        @keyup.enter="handleSearch"
      />
      <button
        class="rounded bg-[var(--vscode-button-background)] px-3 py-1.5 text-sm text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
        :disabled="searching || !selectedSourceId"
        @click="handleSearch"
      >
        {{ searching ? "搜索中..." : "搜索" }}
      </button>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="rounded bg-red-500/20 p-2 text-sm text-red-400">
      {{ error }}
    </div>

    <!-- 书籍列表 -->
    <div v-if="books.length > 0" class="flex flex-col gap-2">
      <div class="text-xs text-[var(--vscode-descriptionForeground)]">
        找到 {{ books.length }} 本书籍
      </div>
      <div class="max-h-[300px] overflow-y-auto">
        <div
          v-for="book in books"
          :key="book.bookUrl"
          class="flex cursor-pointer gap-2 rounded p-2 hover:bg-[var(--vscode-list-hoverBackground)]"
          @click="selectBook(book)"
        >
          <!-- 封面 -->
          <div
            class="h-16 w-12 flex-shrink-0 rounded bg-[var(--vscode-editor-background)] bg-cover bg-center"
            :style="book.coverUrl ? { backgroundImage: `url(${book.coverUrl})` } : {}"
          >
            <div v-if="!book.coverUrl" class="flex h-full items-center justify-center text-xs text-[var(--vscode-descriptionForeground)]">
              无封面
            </div>
          </div>
          <!-- 信息 -->
          <div class="flex flex-1 flex-col justify-center overflow-hidden">
            <div class="truncate font-medium">{{ book.name }}</div>
            <div class="truncate text-xs text-[var(--vscode-descriptionForeground)]">
              {{ book.author || "未知作者" }}
            </div>
            <div v-if="book.lastChapter" class="truncate text-xs text-[var(--vscode-descriptionForeground)]">
              {{ book.lastChapter }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="!searching && sources.length > 0"
      class="py-8 text-center text-sm text-[var(--vscode-descriptionForeground)]"
    >
      输入关键词搜索书籍
    </div>

    <!-- 无书源提示 -->
    <div
      v-else-if="sources.length === 0"
      class="py-8 text-center text-sm text-[var(--vscode-descriptionForeground)]"
    >
      请先导入书源
    </div>
  </div>
</template>
