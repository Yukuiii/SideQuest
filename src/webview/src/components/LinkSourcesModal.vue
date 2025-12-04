<script setup lang="ts">
/**
 * 备用书源关联弹窗
 * 负责跨源搜索并勾选备用书源
 */
import { ref, watch, computed } from "vue";
import { sourceManager, parseSearchResults, type BookInfo, type UnifiedSource, parseEsoUrlRule } from "@/core/source";
import type { ShelfBook } from "@/core/shelf/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { httpRequest } from "@/utils/vscode";

interface Props {
  visible: boolean;
  book: ShelfBook | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "save", value: { sourceId: string; sourceName: string; bookUrl: string }[]): void;
}>();

interface Candidate {
  key: string;
  sourceId: string;
  sourceName: string;
  bookUrl: string;
  name: string;
  author?: string;
  lastChapter?: string;
}

const loading = ref(false);
const error = ref("");
const candidates = ref<Candidate[]>([]);
const selectedKeys = ref<Set<string>>(new Set());

const title = computed(() => props.book?.bookInfo.name || "关联备用书源");

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      fetchCandidates();
    } else {
      resetState();
    }
  }
);

function close() {
  emit("update:visible", false);
}

function resetState() {
  loading.value = false;
  error.value = "";
  candidates.value = [];
  selectedKeys.value = new Set();
}

async function fetchCandidates() {
  if (!props.book) return;
  loading.value = true;
  error.value = "";
  candidates.value = [];
  selectedKeys.value = new Set();

  const currentSourceId = props.book.bookInfo.sourceId;
  const keyword = props.book.bookInfo.name;
  const author = props.book.bookInfo.author || "";
  const sources = sourceManager
    .getAll()
    .filter((s) => s.enabled && s.id !== currentSourceId);

  const tasks = sources.map(async (src) => {
    try {
      const requestOptions = buildSearchRequest(src, keyword);
      const response = await httpRequest(requestOptions);
      if (!response.success || !response.data) {
        throw new Error(response.error || "请求失败");
      }
      const parsed = parseSearchResults(src, response.data);
      return { source: src, books: filterMatches(parsed, author, keyword) };
    } catch (e) {
      console.error("[LinkSourcesModal] 搜索失败:", e);
      return { source: src, books: [], error: e instanceof Error ? e.message : "搜索失败" };
    }
  });

  const settled = await Promise.allSettled(tasks);
  const list: Candidate[] = [];
  const errors: string[] = [];

  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      const { source, books, error: errMsg } = result.value;
      if (errMsg) {
        errors.push(`${source.name}: ${errMsg}`);
      }
      books.forEach((book) => {
        const key = `${source.id}::${book.bookUrl}`;
        list.push({
          key,
          sourceId: source.id,
          sourceName: source.name,
          bookUrl: book.bookUrl,
          name: book.name,
          author: book.author,
          lastChapter: book.lastChapter,
        });
      });
    } else {
      // Promise rejected (不太可能，因为我们在 catch 里返回成功对象)
    }
  });

  candidates.value = list;
  if (errors.length > 0) {
    error.value = errors.join("；");
  } else if (list.length === 0) {
    error.value = "未找到可关联的书源";
  }

  loading.value = false;
}

function filterMatches(results: BookInfo[], author: string, keyword: string): BookInfo[] {
  return results.filter((item) => {
    const matchName = item.name.includes(keyword);
    const matchAuthor = author ? (item.author?.includes(author) ?? false) : true;
    return matchName && matchAuthor;
  });
}

/**
 * 构造搜索请求
 */
function buildSearchRequest(source: UnifiedSource, keyword: string) {
  if (!source.raw.searchUrl || !source.raw.searchList) {
    throw new Error("书源未配置搜索规则");
  }
  const urlRule = parseEsoUrlRule(source.raw.searchUrl, { keyword }, source.raw.host);
  return {
    url: urlRule.url,
    method: (urlRule.method || "GET") as "GET" | "POST",
    headers: urlRule.headers,
    body: urlRule.body,
    charset: urlRule.charset || source.raw.charset,
  };
}

function toggleSelection(key: string) {
  const next = new Set(selectedKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  selectedKeys.value = next;
}

function handleSave() {
  const selected = candidates.value.filter((c) => selectedKeys.value.has(c.key));
  emit(
    "save",
    selected.map((c) => ({
      sourceId: c.sourceId,
      sourceName: c.sourceName,
      bookUrl: c.bookUrl,
    }))
  );
  close();
}
</script>

<template>
  <Dialog :open="visible" @update:open="emit('update:visible', $event)">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>关联备用书源</DialogTitle>
        <DialogDescription>
          当前书籍：{{ title }}
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-[220px] space-y-2">
        <div v-if="loading" class="text-sm text-[var(--vscode-descriptionForeground)]">
          正在搜索其他书源...
        </div>
        <div v-else-if="error" class="rounded bg-red-500/10 p-2 text-sm text-red-400">
          {{ error }}
        </div>
        <div v-else-if="candidates.length === 0" class="text-sm text-[var(--vscode-descriptionForeground)]">
          未找到可关联的书源
        </div>
        <div v-else class="max-h-64 space-y-2 overflow-auto">
          <div
            v-for="item in candidates"
            :key="item.key"
            class="flex items-start gap-2 rounded border border-[var(--vscode-panel-border)] p-2"
          >
            <input
              type="checkbox"
              :checked="selectedKeys.has(item.key)"
              class="mt-1"
              @change="toggleSelection(item.key)"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <span class="truncate font-medium">{{ item.name }}</span>
                <span class="rounded bg-[var(--vscode-badge-background)] px-2 py-0.5 text-xs text-[var(--vscode-badge-foreground)]">
                  {{ item.sourceName }}
                </span>
              </div>
              <div class="text-xs text-[var(--vscode-descriptionForeground)] truncate">
                {{ item.author || "未知作者" }} · {{ item.lastChapter || "无最新章节信息" }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button variant="outline" size="sm" @click="close">取消</Button>
        <Button size="sm" :disabled="loading || selectedKeys.size === 0" @click="handleSave">
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
