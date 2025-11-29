<script setup lang="ts">
/**
 * 情报员视图组件
 * 提供热点新闻聚合功能
 */
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { hotClients, type HotItem, type HotClient } from "../core/news";

const router = useRouter();

/** 当前选中的热点源 */
const currentClient = ref<HotClient>(hotClients[0]!);
/** 热点列表 */
const hotList = ref<HotItem[]>([]);
/** 加载状态 */
const loading = ref(false);
/** 错误信息 */
const error = ref("");
/** 上次更新时间 */
const lastUpdate = ref<Date | null>(null);

/**
 * 返回首页
 */
function goBack() {
  router.push("/");
}

/**
 * 加载热点数据
 */
async function loadHotList() {
  loading.value = true;
  error.value = "";

  try {
    hotList.value = await currentClient.value.fetchHotList();
    lastUpdate.value = new Date();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
    console.error("[热点] 加载失败:", e);
  } finally {
    loading.value = false;
  }
}

/**
 * 切换热点源
 */
function switchSource(client: HotClient) {
  currentClient.value = client;
  loadHotList();
}

/**
 * 打开链接
 */
function openLink(url: string) {
  window.open(url, "_blank");
}

/**
 * 格式化更新时间
 */
function formatUpdateTime(date: Date | null): string {
  if (!date) {
    return "";
  }
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

// 页面加载时获取数据
onMounted(() => {
  loadHotList();
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
      <span class="flex-1 font-medium">📰 情报员</span>
      <button
        class="flex h-6 w-6 items-center justify-center rounded border-none bg-transparent text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] cursor-pointer"
        :class="{ 'animate-spin': loading }"
        @click="loadHotList"
        :disabled="loading"
        title="刷新"
      >
        ↻
      </button>
    </div>

    <!-- 热点源切换 -->
    <div class="flex gap-2 border-b border-[var(--vscode-panel-border)] p-2">
      <button
        v-for="client in hotClients"
        :key="client.source.id"
        class="rounded px-3 py-1 text-sm transition-colors"
        :class="
          currentClient.source.id === client.source.id
            ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
            : 'bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]'
        "
        @click="switchSource(client)"
      >
        {{ client.source.icon }} {{ client.source.name }}
      </button>
    </div>

    <!-- 更新时间 -->
    <div
      v-if="lastUpdate"
      class="px-3 py-1 text-xs text-[var(--vscode-descriptionForeground)]"
    >
      更新于 {{ formatUpdateTime(lastUpdate) }}
    </div>

    <!-- 热点列表 -->
    <div class="flex-1 overflow-auto">
      <!-- 加载中 -->
      <div v-if="loading && hotList.length === 0" class="flex h-full items-center justify-center">
        <span class="text-sm text-[var(--vscode-descriptionForeground)]">加载中...</span>
      </div>

      <!-- 错误提示 -->
      <div v-else-if="error" class="flex h-full flex-col items-center justify-center gap-2 p-4">
        <span class="text-sm text-red-400">{{ error }}</span>
        <button
          class="rounded bg-[var(--vscode-button-background)] px-3 py-1 text-sm text-[var(--vscode-button-foreground)]"
          @click="loadHotList"
        >
          重试
        </button>
      </div>

      <!-- 列表内容 -->
      <div v-else class="flex flex-col">
        <div
          v-for="item in hotList"
          :key="item.rank"
          class="flex cursor-pointer items-start gap-3 border-b border-[var(--vscode-panel-border)] p-3 hover:bg-[var(--vscode-list-hoverBackground)]"
          @click="openLink(item.url)"
        >
          <!-- 排名 -->
          <span
            class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-xs font-medium"
            :class="
              item.rank <= 3
                ? 'bg-red-500 text-white'
                : 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'
            "
          >
            {{ item.rank }}
          </span>

          <!-- 内容 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm leading-tight">{{ item.title }}</span>
              <span
                v-if="item.tag"
                class="flex-shrink-0 rounded px-1 text-xs"
                :class="
                  item.tag === '热' || item.tag === '沸'
                    ? 'bg-red-500/20 text-red-400'
                    : item.tag === '新'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-gray-500/20 text-gray-400'
                "
              >
                {{ item.tag }}
              </span>
            </div>
            <div
              v-if="item.hot"
              class="mt-1 text-xs text-[var(--vscode-descriptionForeground)]"
            >
              {{ item.hot }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
