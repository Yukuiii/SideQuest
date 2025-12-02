<script setup lang="ts">
/**
 * 阅读者视图组件
 * 提供小说阅读功能：书源导入、搜索、阅读
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useDebounceFn } from "@vueuse/core";
import SourceImport from "../components/SourceImport.vue";
import BookList from "../components/BookList.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import ReaderControls from "../components/ReaderControls.vue";
import ShelfView from "../components/ShelfView.vue";
import type { BookInfo, ChapterInfo } from "../core/source";
import type { ShelfBook } from "../core/shelf/types";
import { sourceManager, getChapters, getContent, preloadChapter } from "../core/source";
import { loadReaderPrefs, saveReaderPrefs, FONT_SIZES, LINE_HEIGHTS } from "../utils/readerPrefs";
import type { ReaderPrefs } from "../utils/readerPrefs";
import { addToShelf, updateProgress, getBookProgress } from "../core/shelf/shelfManager";
import { getCacheStats, clearAllCache } from "../core/cache/cacheManager";

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
const error = ref<{
  message: string;
  retry?: () => void;
} | null>(null);
/** 是否显示章节列表 */
const showChapterList = ref(false);
/** 删除确认对话框状态 */
const showDeleteConfirm = ref(false);
/** 待删除的书源 */
const pendingDeleteSource = ref<{ id: string; name: string } | null>(null);
/** 清空缓存确认对话框状态 */
const showClearCacheConfirm = ref(false);

/** 阅读器偏好设置 */
const prefs = ref<ReaderPrefs>(loadReaderPrefs());

/** 书架组件引用 */
const shelfViewRef = ref<InstanceType<typeof ShelfView> | null>(null);

/** 正文容器引用 */
const contentContainerRef = ref<HTMLElement | null>(null);

// 监听偏好变化，自动保存
watch(prefs, saveReaderPrefs, { deep: true });

/**
 * 保存当前阅读进度（防抖）
 */
const saveProgress = useDebounceFn(() => {
  if (!selectedBook.value || chapters.value.length === 0) return;

  const scrollPosition = contentContainerRef.value?.scrollTop || 0;
  updateProgress(
    selectedBook.value.bookUrl,
    currentChapterIndex.value,
    scrollPosition,
    chapters.value.length
  );
}, 500);

/**
 * 监听滚动事件，保存进度
 */
function handleScroll() {
  saveProgress();
}


/** 当前字号（像素值） */
const currentFontSize = computed(() => FONT_SIZES[prefs.value.fontSizeIndex]);
/** 当前行高 */
const currentLineHeight = computed(() => LINE_HEIGHTS[prefs.value.lineHeightIndex]);
/** 当前字重 */
const currentFontWeight = computed(() => prefs.value.fontWeight);

/** 当前书源 */
const currentSource = computed(() => {
  if (!selectedBook.value) return null;
  return sourceManager.getById(selectedBook.value.sourceId);
});

/** 当前章节 */
const currentChapter = computed(() => {
  return chapters.value[currentChapterIndex.value];
});

/** 缓存统计信息 */
const cacheStats = computed(() => getCacheStats());

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
  console.log("[NovelView] 选择书籍:", book);
  console.log("[NovelView] bookUrl:", book.bookUrl);

  // 清空旧书籍的状态，防止显示错配
  chapters.value = [];
  content.value = "";
  currentChapterIndex.value = 0;
  error.value = null;

  selectedBook.value = book;
  await loadChapters();

  // 章节加载成功后，检查是否有进度，或者从第一章开始
  if (chapters.value.length > 0) {
    const progress = getBookProgress(book.bookUrl);
    if (progress) {
      // 有进度记录，恢复到上次阅读位置
      currentChapterIndex.value = progress.chapterIndex;
      await readChapter(progress.chapterIndex);
      // 恢复滚动位置
      await nextTick();
      if (contentContainerRef.value) {
        contentContainerRef.value.scrollTop = progress.scrollPosition;
      }
    } else {
      // 没有进度记录，从第一章开始，并添加到书架
      await readChapter(0);
      addToShelf({
        bookInfo: book,
        status: "reading",
        chapterIndex: 0,
        totalChapters: chapters.value.length,
        scrollPosition: 0,
        addedAt: Date.now(),
        lastReadAt: Date.now(),
      });
      // 刷新书架视图
      shelfViewRef.value?.refresh();
    }
  }
}

/**
 * 从书架继续阅读
 */
async function handleContinueReading(shelfBook: ShelfBook) {
  console.log("[NovelView] 从书架继续阅读:", shelfBook);

  // 清空旧状态
  chapters.value = [];
  content.value = "";
  error.value = null;

  // 设置书籍和进度
  selectedBook.value = shelfBook.bookInfo;
  currentChapterIndex.value = shelfBook.chapterIndex;

  // 加载章节列表
  await loadChapters();

  // 章节加载成功后，阅读指定章节
  if (chapters.value.length > 0) {
    await readChapter(shelfBook.chapterIndex);
    // 恢复滚动位置
    await nextTick();
    if (contentContainerRef.value) {
      contentContainerRef.value.scrollTop = shelfBook.scrollPosition;
    }
  }
}

/**
 * 加载章节列表
 */
async function loadChapters() {
  console.log("[NovelView] 开始加载章节...");
  console.log("[NovelView] selectedBook:", selectedBook.value);
  console.log("[NovelView] currentSource:", currentSource.value?.name);
  if (!selectedBook.value || !currentSource.value) {
    console.log("[NovelView] 缺少书籍或书源，取消加载");
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    console.log("[NovelView] 调用 getChapters...");
    const result = await getChapters(currentSource.value, selectedBook.value);
    console.log("[NovelView] 获取到章节数:", result.length);
    chapters.value = result;
    if (chapters.value.length === 0) {
      error.value = { message: "该书籍暂无章节" };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载章节失败";
    error.value = {
      message,
      retry: loadChapters, // 提供重试回调
    };
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
  error.value = null;

  const chapter = chapters.value[index];

  try {
    const result = await getContent(currentSource.value, chapter);
    content.value = result;
    if (!result || result.trim() === "") {
      error.value = { message: "章节内容为空" };
    } else {
      // 内容加载成功，重置滚动位置到顶部
      await nextTick();
      if (contentContainerRef.value) {
        contentContainerRef.value.scrollTop = 0;
      }
      // 保存进度到书架
      if (selectedBook.value) {
        const existingProgress = getBookProgress(selectedBook.value.bookUrl);
        if (existingProgress) {
          // 更新已有的进度
          updateProgress(
            selectedBook.value.bookUrl,
            index,
            0, // 新章节从顶部开始
            chapters.value.length
          );
        } else {
          // 首次阅读，添加到书架
          addToShelf({
            bookInfo: selectedBook.value,
            status: "reading",
            chapterIndex: index,
            totalChapters: chapters.value.length,
            scrollPosition: 0,
            addedAt: Date.now(),
            lastReadAt: Date.now(),
          });
        }
        // 刷新书架视图
        shelfViewRef.value?.refresh();
      }

      // 预加载下一章（1秒后）
      const nextIndex = index + 1;
      if (nextIndex < chapters.value.length && currentSource.value) {
        const nextChapter = chapters.value[nextIndex];
        if (nextChapter) {
          setTimeout(() => {
            if (currentSource.value && nextChapter) {
              preloadChapter(currentSource.value, nextChapter);
            }
          }, 1000);
        }
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载内容失败";
    error.value = {
      message,
      retry: () => readChapter(index), // 提供重试回调
    };
  } finally {
    loading.value = false;
  }
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

/**
 * 清空缓存 - 显示确认对话框
 */
function handleClearCache() {
  showClearCacheConfirm.value = true;
}

/**
 * 确认清空缓存
 */
function confirmClearCache() {
  clearAllCache();
}

/**
 * 快捷键处理函数
 */
function handleKeydown(event: KeyboardEvent) {
  // 仅在阅读模式生效
  if (!selectedBook.value || !content.value) return;

  // 排除输入框
  const target = event.target as HTMLElement;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
    return;
  }

  const keyHandlers: Record<string, () => void> = {
    "d": () => {
      showChapterList.value = !showChapterList.value;
    },
    "f": () => {
      const nextIndex = (prefs.value.fontSizeIndex + 1) % FONT_SIZES.length;
      prefs.value = { ...prefs.value, fontSizeIndex: nextIndex };
    },
    "b": () => {
      prefs.value = { ...prefs.value, hideContent: !prefs.value.hideContent };
    },
  };

  const handler = keyHandlers[event.key.toLowerCase()];
  if (handler) {
    event.preventDefault();
    handler();
  }
}

// 注册快捷键监听器
onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

// 移除快捷键监听器
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
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
    </div>

    <!-- 阅读内容 -->
    <template v-if="selectedBook && content">
      <div class="flex flex-1 flex-col overflow-hidden">
        <!-- 控制栏 -->
        <ReaderControls :prefs="prefs" @update:prefs="prefs = $event" />

        <!-- 老板键遮罩 -->
        <div v-if="prefs.hideContent" class="flex flex-1 items-center justify-center">
          <div class="text-center text-sm text-[var(--vscode-descriptionForeground)]">
            <p>内容已隐藏</p>
            <p class="mt-2 text-xs">按 B 键恢复显示</p>
          </div>
        </div>

        <!-- 正文区域 -->
        <div
          v-else
          ref="contentContainerRef"
          class="flex-1 overflow-auto p-4"
          @scroll="handleScroll"
        >
          <!-- 章节标题 -->
          <h3 class="mb-4 text-center font-medium">{{ currentChapter?.name }}</h3>
          <!-- 正文 -->
          <div
            class="prose prose-invert mx-auto"
            :style="{
              fontSize: `${currentFontSize}px`,
              lineHeight: currentLineHeight,
              fontWeight: currentFontWeight
            }"
            v-html="content"
          ></div>
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
      <div class="flex flex-1 flex-col overflow-hidden p-4">
        <!-- 书架 -->
        <div v-if="activeTab === 'shelf'" class="flex-1 overflow-hidden">
          <ShelfView ref="shelfViewRef" @continue-reading="handleContinueReading" />
        </div>

        <!-- 搜索 -->
        <div v-else-if="activeTab === 'search'" class="flex-1 overflow-hidden">
          <BookList @select="handleSelectBook" />
        </div>

        <!-- 书源导入 -->
        <div v-else-if="activeTab === 'import'" class="flex flex-1 flex-col overflow-hidden">
          <SourceImport @imported="activeTab = 'search'" />

          <!-- 缓存管理 -->
          <div class="mt-4 flex items-center justify-between rounded border border-[var(--vscode-panel-border)] p-3">
            <div class="flex flex-col gap-1">
              <div class="text-sm font-medium">章节缓存</div>
              <div class="text-xs text-[var(--vscode-descriptionForeground)]">
                {{ cacheStats.count }} 章节 · {{ cacheStats.sizeText }}
              </div>
            </div>
            <button
              class="rounded bg-[var(--vscode-button-secondaryBackground)] px-3 py-1.5 text-xs hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
              @click="handleClearCache"
            >
              清空缓存
            </button>
          </div>

          <!-- 已导入的书源 -->
          <div class="mt-4 flex flex-1 flex-col overflow-hidden">
            <div class="mb-2 text-sm text-[var(--vscode-descriptionForeground)]">
              已导入 {{ sourceManager.getAll().length }} 个书源
            </div>
            <div class="flex flex-1 flex-col gap-1 overflow-y-auto">
              <div
                v-for="source in sourceManager.getAll()"
                :key="source.id"
                class="flex items-center justify-between rounded bg-[var(--vscode-editor-background)] p-2 text-sm"
              >
                <span class="flex-1 truncate">{{ source.name }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-[var(--vscode-descriptionForeground)]">ESO</span>
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
        </div>
      </div>
    </template>

    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div class="flex flex-col items-center gap-2">
        <div
          class="h-8 w-8 animate-spin rounded-full border-4 border-[var(--vscode-progressBar-background)] border-t-transparent"
        ></div>
        <div class="text-sm text-white">加载中...</div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="error"
      class="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded bg-[var(--vscode-inputValidation-errorBackground)] p-3 text-sm text-[var(--vscode-inputValidation-errorForeground)]"
    >
      <span>{{ error.message }}</span>
      <div class="flex gap-2">
        <button
          v-if="error.retry"
          class="rounded bg-[var(--vscode-button-background)] px-3 py-1 text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
          @click="error.retry"
        >
          重试
        </button>
        <button
          class="rounded px-3 py-1 hover:bg-white/10"
          @click="error = null"
        >
          关闭
        </button>
      </div>
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

    <!-- 清空缓存确认对话框 -->
    <ConfirmDialog
      v-model:visible="showClearCacheConfirm"
      title="清空缓存"
      message="确定要清空所有章节缓存吗？清空后将需要重新下载章节内容。"
      confirm-text="清空"
      :danger="true"
      @confirm="confirmClearCache"
    />
  </div>
</template>

<style scoped>
.prose :deep(p) {
  margin-bottom: 1em;
  text-indent: 2em;
}
</style>
