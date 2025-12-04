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
import DisguiseView from "../components/DisguiseView.vue";
import ShelfView from "../components/ShelfView.vue";
import type { BookInfo, ChapterInfo } from "../core/source";
import type { ShelfBook } from "../core/shelf/types";
import { sourceManager, getChapters, getContent, preloadChapter } from "../core/source";
import { loadReaderPrefs, saveReaderPrefs, FONT_SIZES, LINE_HEIGHTS } from "../utils/readerPrefs";
import type { ReaderPrefs } from "../utils/readerPrefs";
import { addToShelf, updateProgress, getBookProgress, replaceBookInfo } from "../core/shelf/shelfManager";
import { getCacheStats, clearAllCache } from "../core/cache/cacheManager";
import { showToast } from "../utils/toast";
import { postMessage } from "../utils/vscode";

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
/** 是否处于自动滚动 */
const isAutoScrolling = ref(false);
let autoScrollFrame: number | null = null;

// 监听偏好变化，自动保存
watch(prefs, saveReaderPrefs, { deep: true });

// 监听标签页切换，刷新缓存统计
watch(activeTab, (newTab) => {
  if (newTab === "import") {
    refreshCacheStats();
  }
});

/**
 * 保存当前阅读进度（防抖）
 */
const saveProgress = useDebounceFn(() => {
  if (!selectedBook.value || chapters.value.length === 0) return;

  const scrollPosition = getCurrentScroll();
  console.log("[NovelView] 保存进度", {
    bookUrl: selectedBook.value.bookUrl,
    chapterIndex: currentChapterIndex.value,
    scrollPosition,
    total: chapters.value.length,
  });
  updateProgress(
    selectedBook.value.bookUrl,
    currentChapterIndex.value,
    scrollPosition,
    chapters.value.length
  );
}, 500);

/**
 * 立即保存进度（不去抖）
 */
function persistProgressImmediate() {
  if (!selectedBook.value || chapters.value.length === 0) return;
  const scrollPosition = getCurrentScroll();
  console.log("[NovelView] 立即保存进度", {
    bookUrl: selectedBook.value.bookUrl,
    chapterIndex: currentChapterIndex.value,
    scrollPosition,
    total: chapters.value.length,
  });
  updateProgress(
    selectedBook.value.bookUrl,
    currentChapterIndex.value,
    scrollPosition,
    chapters.value.length
  );
}

/**
 * 监听滚动事件，保存进度
 */
function handleScroll() {
  if (restoringScroll.value === null) {
    saveProgress();
  } else {
    console.log("[NovelView] 滚动忽略（正在恢复）", restoringScroll.value);
  }
}

// 监听正文容器 ref 变化，确保绑定滚动监听
watch(
  contentContainerRef,
  (el, prev) => {
    if (prev) {
      prev.removeEventListener("scroll", handleScroll);
    }
    if (el) {
      el.addEventListener("scroll", handleScroll, { passive: true });
      console.log("[NovelView] 已绑定正文滚动监听");
    }
  },
  { flush: "post" }
);

// 监听窗口滚动（兜底场景）
onMounted(() => {
  window.addEventListener("scroll", handleScroll, { passive: true });
});
onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});


/** 当前字号（像素值） */
const currentFontSize = computed(() => FONT_SIZES[prefs.value.fontSizeIndex]);
/** 当前行高 */
const currentLineHeight = computed(() => LINE_HEIGHTS[prefs.value.lineHeightIndex]);
/** 当前字重 */
const currentFontWeight = computed(() => prefs.value.fontWeight);
/** 是否处于伪装模式 */
const isDisguised = ref(false);
/** 当前伪装模板 */
const disguiseTemplate = ref<"terminal" | "stacktrace">("terminal");
/** 伪装内容刷新 key（进入伪装时递增） */
const disguiseRefreshKey = ref(0);

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
const cacheStats = ref(getCacheStats());
/** 正在恢复滚动位置的标记（避免覆盖进度） */
const restoringScroll = ref<number | null>(null);

/**
 * 返回首页
 */
function goBack() {
  if (selectedBook.value) {
    persistProgressImmediate();
    selectedBook.value = null;
    chapters.value = [];
    content.value = "";
    isDisguised.value = false;
    stopAutoScroll();
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
  isDisguised.value = false;
  stopAutoScroll();

  selectedBook.value = book;
  await loadChapters();

  // 章节加载成功后，检查是否有进度，或者从第一章开始
  if (chapters.value.length > 0) {
    const progress = getBookProgress(book.bookUrl);
    if (progress) {
      // 有进度记录，恢复到上次阅读位置
      // 校验章节索引有效性，防止书源章节数变化导致越界
      const validChapterIndex = Math.max(0, Math.min(progress.chapterIndex, chapters.value.length - 1));
      if (validChapterIndex !== progress.chapterIndex) {
        console.warn(`[NovelView] 章节索引越界，已调整：${progress.chapterIndex} → ${validChapterIndex}`);
      }
      currentChapterIndex.value = validChapterIndex;
      restoringScroll.value = progress.scrollPosition ?? 0;
      console.log("[NovelView] 恢复进度", {
        chapterIndex: validChapterIndex,
        scroll: restoringScroll.value,
      });
      await readChapter(validChapterIndex);
      // 恢复滚动位置
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
  isDisguised.value = false;
  stopAutoScroll();

  // 设置书籍和进度
  selectedBook.value = shelfBook.bookInfo;
  currentChapterIndex.value = shelfBook.chapterIndex;

  // 加载章节列表
  await loadChapters();

  // 章节加载成功后，阅读指定章节
  if (chapters.value.length > 0) {
    restoringScroll.value = shelfBook.scrollPosition ?? 0;
    console.log("[NovelView] 继续阅读恢复进度", {
      chapterIndex: shelfBook.chapterIndex,
      scroll: restoringScroll.value,
    });
    // 校验章节索引有效性，防止书源章节数变化导致越界
    const validChapterIndex = Math.max(0, Math.min(shelfBook.chapterIndex, chapters.value.length - 1));
    if (validChapterIndex !== shelfBook.chapterIndex) {
      console.warn(`[NovelView] 章节索引越界，已调整：${shelfBook.chapterIndex} → ${validChapterIndex}`);
    }
    await readChapter(validChapterIndex);
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
async function readChapter(index: number, allowFallback = true) {
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
      // 内容加载成功，准备恢复滚动位置
      const shouldSkipProgressUpdate = restoringScroll.value !== null;
      const targetScroll = restoringScroll.value ?? 0;

      // 等待 DOM 渲染完成后恢复滚动
      await nextTick();

      if (targetScroll > 0 && contentContainerRef.value) {
        // 使用 requestAnimationFrame 轮询等待内容高度就绪
        const el = contentContainerRef.value;
        let attempts = 0;
        const maxAttempts = 20; // 最多尝试 20 次（约 330ms）

        const tryRestore = () => {
          attempts++;
          const maxScroll = el.scrollHeight - el.clientHeight;

          console.log(`[NovelView] 尝试恢复滚动 (${attempts}/${maxAttempts})`, {
            targetScroll,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            maxScroll,
          });

          // 如果内容高度足够，或已达到最大尝试次数，执行恢复
          if (maxScroll >= targetScroll || attempts >= maxAttempts) {
            el.scrollTop = targetScroll;
            if (typeof el.scrollTo === "function") {
              el.scrollTo({ top: targetScroll, behavior: "auto" });
            }

            console.log("[NovelView] 滚动恢复完成", {
              expected: targetScroll,
              actual: el.scrollTop,
              attempts,
            });

            // 清空恢复标记，允许后续保存
            restoringScroll.value = null;
          } else {
            // 继续等待
            requestAnimationFrame(tryRestore);
          }
        };

        requestAnimationFrame(tryRestore);
      } else {
        // 不需要恢复滚动，立即清空标记
        restoringScroll.value = null;
      }

      // 保存进度到书架
      if (selectedBook.value && !shouldSkipProgressUpdate) {
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
        const currentBook = selectedBook.value;
        const currentSourceRef = currentSource.value;
        if (nextChapter && currentBook) {
          setTimeout(() => {
            // 校验上下文：确保用户仍在阅读同一本书的同一章节
            if (
              currentSource.value === currentSourceRef &&
              selectedBook.value === currentBook &&
              currentChapterIndex.value === index &&
              nextChapter
            ) {
              preloadChapter(currentSourceRef, nextChapter);
            } else {
              console.log("[NovelView] 预加载已取消（用户已切换书籍或章节）");
            }
          }, 1000);
        }
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载内容失败";
    if (allowFallback && (await trySwitchToAlternative(index))) {
      // 已成功切换备用源并加载章节
      loading.value = false;
      return;
    }
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
  // 刷新缓存统计
  cacheStats.value = getCacheStats();
}

/**
 * 刷新缓存统计
 */
function refreshCacheStats() {
  cacheStats.value = getCacheStats();
}

/**
 * 尝试切换到备用书源
 */
async function trySwitchToAlternative(targetIndex: number): Promise<boolean> {
  if (!selectedBook.value?.alternativeSources || selectedBook.value.alternativeSources.length === 0) {
    return false;
  }

  const originalBook = selectedBook.value;
  const originalSource = sourceManager.getById(originalBook.sourceId);
  const alternatives = [...selectedBook.value.alternativeSources];

  // 确保当前源也记录在备用列表中，便于回退
  if (!alternatives.some((item) => item.sourceId === originalBook.sourceId)) {
    alternatives.unshift({
      sourceId: originalBook.sourceId,
      sourceName: originalSource?.name || "当前源",
      bookUrl: originalBook.bookUrl,
    });
  }

  const fallbackList = alternatives.filter((item) => item.sourceId !== originalBook.sourceId);

  for (const alt of fallbackList) {
    const altSource = sourceManager.getById(alt.sourceId);
    if (!altSource) continue;

    const altBook: BookInfo = {
      ...originalBook,
      sourceId: alt.sourceId,
      bookUrl: alt.bookUrl,
      alternativeSources: alternatives,
    };

    try {
      const altChapters = await getChapters(altSource, altBook);
      if (altChapters.length === 0) continue;

      chapters.value = altChapters;
      selectedBook.value = altBook;

      const validIndex = Math.max(0, Math.min(targetIndex, altChapters.length - 1));
      currentChapterIndex.value = validIndex;
      replaceBookInfo(originalBook.bookUrl, altBook, validIndex);

      await readChapter(validIndex, false);
      return true;
    } catch (err) {
      console.warn("[NovelView] 切换备用源失败:", err);
    }
  }

  return false;
}

function pickDisguiseTemplate() {
  disguiseTemplate.value = Math.random() > 0.5 ? "terminal" : "stacktrace";
}

function toggleDisguise(source: "ui" | "hotkey" | "command" = "ui") {
  if (!selectedBook.value || !content.value) {
    showToast("打开书籍后才可使用老板键");
    return;
  }
  const nextDisguise = !isDisguised.value;
  if (nextDisguise) {
    pickDisguiseTemplate();
    disguiseRefreshKey.value += 1;
    stopAutoScroll();
  }
  isDisguised.value = nextDisguise;
  postMessage("toggleDisguise", {
    mode: nextDisguise ? "disguise" : "reading",
    template: disguiseTemplate.value,
    source,
  });
}

function handleExtensionMessage(event: MessageEvent) {
  const message = event.data as { command?: string; payload?: any };
  if (!message || typeof message !== "object") return;
  if (message.command === "toggleDisguise") {
    const template = message.payload?.template;
    if (template === "terminal" || template === "stacktrace") {
      disguiseTemplate.value = template;
    }
    toggleDisguise("command");
  }
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
      toggleDisguise("hotkey");
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
  window.addEventListener("message", handleExtensionMessage);
});

// 移除快捷键监听器
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("message", handleExtensionMessage);
  stopAutoScroll();
});

/**
 * 开启自动滚动
 */
function startAutoScroll() {
  if (isAutoScrolling.value) return;
  isAutoScrolling.value = true;
  const step = () => {
    if (!contentContainerRef.value) {
      stopAutoScroll();
      return;
    }
    const el = contentContainerRef.value;
    const max = el.scrollHeight - el.clientHeight;
    const next = el.scrollTop + 0.8;
    if (next >= max) {
      el.scrollTop = max;
      stopAutoScroll();
      return;
    }
    el.scrollTop = next;
    autoScrollFrame = requestAnimationFrame(step);
  };
  autoScrollFrame = requestAnimationFrame(step);
}

/**
 * 停止自动滚动
 */
function stopAutoScroll() {
  if (autoScrollFrame !== null) {
    cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = null;
  }
  isAutoScrolling.value = false;
}

/**
 * 切换自动滚动
 */
function toggleAutoScroll() {
  if (isAutoScrolling.value) {
    stopAutoScroll();
  } else {
    startAutoScroll();
  }
}

/**
 * 快速滚动到顶部，便于返回/调整样式
 */
function scrollToTop() {
  const el = contentContainerRef.value;
  if (el) {
    console.log("[NovelView] scrollToTop container before:", el.scrollTop, el.scrollHeight, el.clientHeight);
    el.scrollTop = 0;
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }
    console.log("[NovelView] scrollToTop container after:", el.scrollTop);
  }
  // 兜底滚动整个页面
  if (typeof window.scrollTo === "function") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

/**
 * 获取当前滚动位置（容器优先，兜底 window）
 */
function getCurrentScroll(): number {
  const el = contentContainerRef.value;
  if (el) {
    const isScrollable = el.scrollHeight - el.clientHeight > 1;
    const val = isScrollable ? el.scrollTop : window.scrollY || document.documentElement.scrollTop || 0;
    return val;
  }
  return window.scrollY || document.documentElement.scrollTop || 0;
}

/**
 * 快速切换字号
 */
function quickToggleFontSize() {
  const nextIndex = (prefs.value.fontSizeIndex + 1) % FONT_SIZES.length;
  prefs.value = { ...prefs.value, fontSizeIndex: nextIndex };
}
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
        {{ isDisguised ? "Side Quest" : (selectedBook ? selectedBook.name : "📚 阅读者") }}
      </span>
    </div>

    <!-- 阅读内容 -->
    <template v-if="selectedBook && content">
      <div class="flex flex-1 flex-col overflow-hidden">
        <!-- 控制栏 -->
        <ReaderControls
          v-if="!isDisguised"
          :prefs="prefs"
          :is-auto-scrolling="isAutoScrolling"
          @update:prefs="prefs = $event"
          @toggle-auto-scroll="toggleAutoScroll"
        />

        <!-- 伪装模式 -->
        <div v-show="isDisguised" class="flex flex-1 flex-col overflow-hidden">
          <DisguiseView :template="disguiseTemplate" :refresh-key="disguiseRefreshKey" />
        </div>

        <!-- 正文区域，使用 v-show 保留 DOM，避免切换回正文时滚动丢失 -->
        <div
          v-show="!isDisguised"
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
        <div v-if="!isDisguised" class="flex items-center gap-2 border-t border-[var(--vscode-panel-border)] p-2">
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

        <!-- 悬浮快捷操作 -->
        <div
          v-if="!isDisguised"
          class="fixed bottom-4 right-4 z-30 flex flex-col gap-2 pointer-events-auto"
        >
          <button
            class="rounded-full bg-[var(--vscode-button-background)] px-3 py-2 text-xs text-[var(--vscode-button-foreground)] shadow-lg hover:bg-[var(--vscode-button-hoverBackground)]"
            title="返回"
            @click="goBack"
          >
            返回
          </button>
          <button
            class="rounded-full bg-[var(--vscode-button-secondaryBackground)] px-3 py-2 text-xs text-[var(--vscode-button-secondaryForeground)] shadow-lg hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
            title="回到顶部"
            @click="scrollToTop"
          >
            顶部
          </button>
          <button
            class="rounded-full bg-[var(--vscode-button-secondaryBackground)] px-3 py-2 text-xs text-[var(--vscode-button-secondaryForeground)] shadow-lg hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
            title="目录"
            @click="showChapterList = true"
          >
            目录
          </button>
          <button
            class="rounded-full bg-[var(--vscode-button-secondaryBackground)] px-3 py-2 text-xs text-[var(--vscode-button-secondaryForeground)] shadow-lg hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
            title="切换字号"
            @click="quickToggleFontSize"
          >
            字号
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
      class="fixed inset-0 z-40 flex flex-col bg-[var(--vscode-sideBar-background)]"
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
