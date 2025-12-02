<script setup lang="ts">
/**
 * 书架视图组件
 * 显示书架中的书籍，支持继续阅读和删除
 */
import { ref, computed, onMounted } from "vue";
import { loadShelf, removeFromShelf } from "@/core/shelf/shelfManager";
import type { ShelfBook } from "@/core/shelf/types";
import ConfirmDialog from "./ConfirmDialog.vue";
import LinkSourcesModal from "./LinkSourcesModal.vue";
import { updateAlternativeSources } from "@/core/shelf/shelfManager";

const emit = defineEmits<{
  (e: "continueReading", book: ShelfBook): void;
}>();

const shelf = ref(loadShelf());
const activeTab = ref<"reading" | "finished">("reading");

/** 删除确认对话框状态 */
const showDeleteConfirm = ref(false);
/** 待删除的书籍 */
const pendingDeleteBook = ref<{ url: string; name: string } | null>(null);
/** 关联备用源弹窗 */
const showLinkModal = ref(false);
const linkingBook = ref<ShelfBook | null>(null);

const filteredBooks = computed(() => {
  return shelf.value.books
    .filter((b) => b.status === activeTab.value)
    .sort((a, b) => b.lastReadAt - a.lastReadAt); // 按最后阅读时间倒序
});

/**
 * 继续阅读
 */
function continueReading(book: ShelfBook) {
  emit("continueReading", book);
}

/**
 * 删除书籍 - 显示确认对话框
 */
function handleRemove(bookUrl: string, bookName: string) {
  pendingDeleteBook.value = { url: bookUrl, name: bookName };
  showDeleteConfirm.value = true;
}

/**
 * 确认删除书籍
 */
function confirmDelete() {
  if (pendingDeleteBook.value) {
    removeFromShelf(pendingDeleteBook.value.url);
    shelf.value = loadShelf();
    pendingDeleteBook.value = null;
  }
}

/**
 * 打开关联备用源弹窗
 */
function openLinkModal(book: ShelfBook) {
  linkingBook.value = book;
  showLinkModal.value = true;
}

/**
 * 保存关联备用源
 */
function handleSaveAlternativeSources(alternatives: { sourceId: string; sourceName: string; bookUrl: string }[]) {
  if (!linkingBook.value) return;
  updateAlternativeSources(linkingBook.value.bookInfo.bookUrl, alternatives);
  shelf.value = loadShelf();
  linkingBook.value = null;
}

/**
 * 控制关联弹窗显示
 */
function handleLinkModalVisible(visible: boolean) {
  showLinkModal.value = visible;
  if (!visible) {
    linkingBook.value = null;
  }
}

/**
 * 刷新书架数据
 */
function refresh() {
  shelf.value = loadShelf();
}

// 组件挂载时加载数据
onMounted(() => {
  refresh();
});

// 暴露刷新方法供父组件调用
defineExpose({ refresh });
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-b border-[var(--vscode-panel-border)] p-3">
      <h2 class="text-lg font-medium">📚 书架</h2>
    </div>

    <div class="flex border-b border-[var(--vscode-panel-border)]">
      <button
        class="flex-1 py-2 text-sm"
        :class="activeTab === 'reading' ? 'border-b-2 border-[var(--vscode-textLink-foreground)] text-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-descriptionForeground)]'"
        @click="activeTab = 'reading'"
      >
        在读
      </button>
      <button
        class="flex-1 py-2 text-sm"
        :class="activeTab === 'finished' ? 'border-b-2 border-[var(--vscode-textLink-foreground)] text-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-descriptionForeground)]'"
        @click="activeTab = 'finished'"
      >
        已读
      </button>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <div v-if="filteredBooks.length === 0" class="py-8 text-center text-sm text-[var(--vscode-descriptionForeground)]">
        暂无书籍
      </div>
      <div v-else class="flex flex-col gap-2">
        <div
          v-for="book in filteredBooks"
          :key="book.bookInfo.bookUrl"
          class="rounded border border-[var(--vscode-panel-border)] p-3"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="font-medium">{{ book.bookInfo.name }}</div>
              <div class="mt-1 text-xs text-[var(--vscode-descriptionForeground)]">
                {{ book.bookInfo.author || "未知作者" }} · 第{{ book.chapterIndex + 1 }}章
              </div>
              <div class="mt-2 flex items-center gap-2">
                <div class="text-xs">
                  进度: {{ Math.round((book.chapterIndex + 1) / book.totalChapters * 100) }}%
                </div>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                class="rounded bg-[var(--vscode-button-background)] px-3 py-1 text-xs text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                @click="continueReading(book)"
              >
                继续
              </button>
              <button
                class="rounded bg-[var(--vscode-button-secondaryBackground)] px-3 py-1 text-xs text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                @click="openLinkModal(book)"
              >
                备用源
              </button>
              <button
                class="text-xs text-red-400 hover:text-red-300"
                @click="handleRemove(book.bookInfo.bookUrl, book.bookInfo.name)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      v-model:visible="showDeleteConfirm"
      title="删除书籍"
      :message="`确定要从书架移除「${pendingDeleteBook?.name}」吗？`"
      confirm-text="删除"
      :danger="true"
      @confirm="confirmDelete"
    />

    <LinkSourcesModal
      :visible="showLinkModal"
      :book="linkingBook"
      @update:visible="handleLinkModalVisible"
      @save="handleSaveAlternativeSources"
    />
  </div>
</template>
