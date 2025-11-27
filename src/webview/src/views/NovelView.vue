<script setup lang="ts">
/**
 * 阅读者视图组件
 * 提供小说阅读功能：书源导入、搜索、阅读
 */
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import SourceImport from "../components/SourceImport.vue";
import BookList from "../components/BookList.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import type { BookInfo, ChapterInfo } from "../core/source";
import { sourceManager, getChapters, getContent, bookshelf } from "../core/source";

const router = useRouter();

/** 当前标签页 */
const activeTab = ref<"shelf" | "search" | "import">("shelf");
/** 当前选中的书籍 */
const selectedBook = ref<BookInfo | null>(null);
/** 章节列表 */
const chapters = ref<ChapterInfo[]>([]);
/** 当前阅读的章节索引 */
const currentChapterIndex = ref(0);
/** 章节内容 */
const content = ref("");
/** 是否正在加载 */
const loading = ref(false);
/** 错误信息 */
const error = ref("");
/** 是否显示章节列表 */
const showChapterList = ref(false);
/** 删除确认对话框状态 */
const showDeleteConfirm = ref(false);
/** 待删除的书源 */
const pendingDeleteSource = ref<{ id: string; name: string } | null>(null);

/** 书架书籍 */
const shelfBooks = ref(bookshelf.getAll());

/** 当前书源 */
const currentSource = computed(() => {
  if (!selectedBook.value) return null;
  return sourceManager.getById(selectedBook.value.sourceId);
});

/** 当前章节 */
const currentChapter = computed(() => {
  return chapters.value[currentChapterIndex.value];
});

/**
 * 返回首页
 */
function goBack() {
  if (selectedBook.value) {
    selectedBook.value = null;
    chapters.value = [];
    content.value = "";
  } else {
    router.push("/");
  }
}

/**
 * 选择书籍
 */
async function handleSelectBook(book: BookInfo) {
  selectedBook.value = book;
  await loadChapters();
}

/**
 * 加载章节列表
 */
async function loadChapters() {
  if (!selectedBook.value || !currentSource.value) return;

  loading.value = true;
  error.value = "";

  try {
    // 从网络加载
    const result = await getChapters(currentSource.value, selectedBook.value);
    chapters.value = result;

    // 恢复阅读进度
    const shelfBook = bookshelf.getByUrl(selectedBook.value.bookUrl);
    if (shelfBook?.lastChapterIndex !== undefined) {
      currentChapterIndex.value = shelfBook.lastChapterIndex;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载章节失败";
    console.error("加载章节失败:", e);
  } finally {
    loading.value = false;
  }
}

/**
 * 阅读章节
 */
async function readChapter(index: number) {
  if (!currentSource.value || !chapters.value[index]) return;

  currentChapterIndex.value = index;
  showChapterList.value = false;
  loading.value = true;
  error.value = "";

  const chapter = chapters.value[index];

  try {
    // 从网络加载
    const result = await getContent(currentSource.value, chapter);
    content.value = result;
    updateProgress();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载内容失败";
  } finally {
    loading.value = false;
  }
}

/**
 * 更新阅读进度
 */
function updateProgress() {
  if (!selectedBook.value || !currentChapter.value) return;

  bookshelf.updateProgress(
    selectedBook.value.bookUrl,
    currentChapterIndex.value,
    currentChapter.value.name,
    chapters.value.length
  );
}

/**
 * 上一章
 */
function prevChapter() {
  if (currentChapterIndex.value > 0) {
    readChapter(currentChapterIndex.value - 1);
  }
}

/**
 * 下一章
 */
function nextChapter() {
  if (currentChapterIndex.value < chapters.value.length - 1) {
    readChapter(currentChapterIndex.value + 1);
  }
}

/**
 * 加入书架
 */
function addToShelf() {
  if (!selectedBook.value) return;

  if (bookshelf.has(selectedBook.value.bookUrl)) {
    bookshelf.remove(selectedBook.value.bookUrl);
  } else {
    bookshelf.add(selectedBook.value);
  }
  shelfBooks.value = bookshelf.getAll();
}

/**
 * 是否已在书架
 */
const isInShelf = computed(() => {
  return selectedBook.value ? bookshelf.has(selectedBook.value.bookUrl) : false;
});

/**
 * 从书架选择书籍
 */
function selectFromShelf(book: BookInfo) {
  // 获取对应的书源
  const source = sourceManager.getById(book.sourceId);
  if (!source) {
    error.value = "书源已删除，无法打开";
    return;
  }
  handleSelectBook(book);
}

/**
 * 删除书源 - 显示确认对话框
 */
function deleteSource(id: string) {
  const source = sourceManager.getById(id);
  if (source) {
    pendingDeleteSource.value = { id, name: source.name };
    showDeleteConfirm.value = true;
  }
}

/**
 * 确认删除书源
 */
function confirmDeleteSource() {
  if (pendingDeleteSource.value) {
    sourceManager.delete(pendingDeleteSource.value.id);
    pendingDeleteSource.value = null;
  }
}

// 监听书架变更
bookshelf.onChange((books) => {
  shelfBooks.value = books;
});
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-[var(--vscode-panel-border)] p-3">
      <button
        class="flex h-6 w-6 items-center justify-center rounded border-none bg-transparent text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] cursor-pointer"
        @click="goBack"
        title="返回"
      >
        ←
      </button>
      <span class="flex-1 font-medium truncate">
        {{ selectedBook ? selectedBook.name : "📚 阅读者" }}
      </span>
      <!-- 加入书架按钮 -->
      <button
        v-if="selectedBook"
        class="text-sm px-2 py-0.5 rounded"
        :class="isInShelf ? 'text-yellow-400' : 'text-[var(--vscode-descriptionForeground)]'"
        @click="addToShelf"
        :title="isInShelf ? '从书架移除' : '加入书架'"
      >
        {{ isInShelf ? "★" : "☆" }}
      </button>
    </div>

    <!-- 阅读内容 -->
    <template v-if="selectedBook && content">
      <div class="flex-1 overflow-auto p-4">
        <!-- 章节标题 -->
        <h3 class="mb-4 text-center font-medium">{{ currentChapter?.name }}</h3>
        <!-- 正文 -->
        <div class="prose prose-invert max-w-none text-sm leading-relaxed" v-html="content"></div>
      </div>
      <!-- 翻页控制 -->
      <div class="flex items-center gap-2 border-t border-[var(--vscode-panel-border)] p-2">
        <button
          class="flex-1 rounded bg-[var(--vscode-button-secondaryBackground)] py-1.5 text-sm disabled:opacity-50"
          :disabled="currentChapterIndex === 0"
          @click="prevChapter"
        >
          上一章
        </button>
        <button
          class="rounded bg-[var(--vscode-button-secondaryBackground)] px-3 py-1.5 text-sm"
          @click="showChapterList = true"
        >
          目录
        </button>
        <button
          class="flex-1 rounded bg-[var(--vscode-button-secondaryBackground)] py-1.5 text-sm disabled:opacity-50"
          :disabled="currentChapterIndex >= chapters.length - 1"
          @click="nextChapter"
        >
          下一章
        </button>
      </div>
    </template>

    <!-- 章节列表（书籍详情） -->
    <template v-else-if="selectedBook && chapters.length > 0">
      <div class="flex-1 overflow-auto p-4">
        <div class="mb-3 text-sm text-[var(--vscode-descriptionForeground)]">
          共 {{ chapters.length }} 章
        </div>
        <div class="flex flex-col gap-1">
          <button
            v-for="(chapter, index) in chapters"
            :key="chapter.url"
            class="rounded p-2 text-left text-sm hover:bg-[var(--vscode-list-hoverBackground)]"
            :class="{ 'text-[var(--vscode-textLink-foreground)]': index === currentChapterIndex }"
            @click="readChapter(index)"
          >
            {{ chapter.name }}
          </button>
        </div>
      </div>
    </template>

    <!-- 主界面（标签页） -->
    <template v-else>
      <!-- 标签页切换 -->
      <div class="flex border-b border-[var(--vscode-panel-border)]">
        <button
          class="flex-1 py-2 text-sm"
          :class="activeTab === 'shelf' ? 'border-b-2 border-[var(--vscode-textLink-foreground)] text-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-descriptionForeground)]'"
          @click="activeTab = 'shelf'"
        >
          书架
        </button>
        <button
          class="flex-1 py-2 text-sm"
          :class="activeTab === 'search' ? 'border-b-2 border-[var(--vscode-textLink-foreground)] text-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-descriptionForeground)]'"
          @click="activeTab = 'search'"
        >
          搜索
        </button>
        <button
          class="flex-1 py-2 text-sm"
          :class="activeTab === 'import' ? 'border-b-2 border-[var(--vscode-textLink-foreground)] text-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-descriptionForeground)]'"
          @click="activeTab = 'import'"
        >
          书源
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-auto p-4">
        <!-- 书架 -->
        <template v-if="activeTab === 'shelf'">
          <div v-if="shelfBooks.length > 0" class="flex flex-col gap-2">
            <div
              v-for="book in shelfBooks"
              :key="book.bookUrl"
              class="flex cursor-pointer gap-2 rounded p-2 hover:bg-[var(--vscode-list-hoverBackground)]"
              @click="selectFromShelf(book)"
            >
              <div
                class="h-16 w-12 flex-shrink-0 rounded bg-[var(--vscode-editor-background)] bg-cover bg-center"
                :style="book.coverUrl ? { backgroundImage: `url(${book.coverUrl})` } : {}"
              ></div>
              <div class="flex flex-1 flex-col justify-center overflow-hidden">
                <div class="truncate font-medium">{{ book.name }}</div>
                <div class="truncate text-xs text-[var(--vscode-descriptionForeground)]">
                  {{ book.author || "未知作者" }}
                </div>
                <div v-if="book.lastChapterName" class="truncate text-xs text-[var(--vscode-descriptionForeground)]">
                  读到：{{ book.lastChapterName }}
                </div>
              </div>
              <div v-if="book.progress" class="self-center text-xs text-[var(--vscode-descriptionForeground)]">
                {{ book.progress }}%
              </div>
            </div>
          </div>
          <div v-else class="py-8 text-center text-sm text-[var(--vscode-descriptionForeground)]">
            书架空空如也，去搜索添加书籍吧
          </div>
        </template>

        <!-- 搜索 -->
        <template v-else-if="activeTab === 'search'">
          <BookList @select="handleSelectBook" />
        </template>

        <!-- 书源导入 -->
        <template v-else-if="activeTab === 'import'">
          <SourceImport @imported="activeTab = 'search'" />
          <!-- 已导入的书源 -->
          <div class="mt-4">
            <div class="mb-2 text-sm text-[var(--vscode-descriptionForeground)]">
              已导入 {{ sourceManager.getAll().length }} 个书源
            </div>
            <div class="flex flex-col gap-1">
              <div
                v-for="source in sourceManager.getAll()"
                :key="source.id"
                class="flex items-center justify-between rounded bg-[var(--vscode-editor-background)] p-2 text-sm"
              >
                <span class="flex-1 truncate">{{ source.name }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-[var(--vscode-descriptionForeground)]">Legado</span>
                  <button
                    class="text-red-400 hover:text-red-300 text-xs px-1"
                    @click="deleteSource(source.id)"
                    title="删除书源"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-black/50"
    >
      <div class="text-sm">加载中...</div>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="error"
      class="absolute bottom-4 left-4 right-4 rounded bg-red-500/90 p-2 text-sm text-white"
    >
      {{ error }}
      <button class="ml-2 underline" @click="error = ''">关闭</button>
    </div>

    <!-- 章节列表弹窗 -->
    <div
      v-if="showChapterList"
      class="absolute inset-0 flex flex-col bg-[var(--vscode-sideBar-background)]"
    >
      <div class="flex items-center justify-between border-b border-[var(--vscode-panel-border)] p-3">
        <span class="font-medium">目录</span>
        <button
          class="text-[var(--vscode-descriptionForeground)]"
          @click="showChapterList = false"
        >
          ✕
        </button>
      </div>
      <div class="flex-1 overflow-auto p-2">
        <button
          v-for="(chapter, index) in chapters"
          :key="chapter.url"
          class="w-full rounded p-2 text-left text-sm hover:bg-[var(--vscode-list-hoverBackground)]"
          :class="{ 'bg-[var(--vscode-list-activeSelectionBackground)]': index === currentChapterIndex }"
          @click="readChapter(index)"
        >
          {{ chapter.name }}
        </button>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      v-model:visible="showDeleteConfirm"
      title="删除书源"
      :message="`确定要删除书源「${pendingDeleteSource?.name}」吗？`"
      confirm-text="删除"
      :danger="true"
      @confirm="confirmDeleteSource"
    />
  </div>
</template>

<style scoped>
.prose :deep(p) {
  margin-bottom: 1em;
  text-indent: 2em;
}
</style>
