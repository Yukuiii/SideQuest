<script setup lang="ts">
/**
 * 书源导入组件
 * 支持导入 ESO 格式书源
 */
import { ref } from "vue";
import { sourceManager } from "../core/source";

const emit = defineEmits<{
  (e: "imported"): void;
}>();

/** 输入框内容 */
const inputText = ref("");
/** 是否正在导入 */
const importing = ref(false);
/** 导入结果消息 */
const message = ref("");
/** 消息类型 */
const messageType = ref<"success" | "error" | "">("");

/**
 * 处理导入
 */
async function handleImport() {
  const text = inputText.value.trim();
  if (!text) {
    showMessage("请输入书源内容", "error");
    return;
  }

  importing.value = true;
  message.value = "";

  try {
    // 格式检测已在 sourceManager.import 内部处理
    const result = sourceManager.import(text);

    if (result.success > 0) {
      showMessage(`成功导入 ${result.success} 个书源`, "success");
      inputText.value = "";
      emit("imported");
    } else {
      showMessage(`导入失败: ${result.errors.join(", ")}`, "error");
    }
  } catch (error) {
    showMessage(`导入异常: ${error instanceof Error ? error.message : "未知错误"}`, "error");
  } finally {
    importing.value = false;
  }
}

/**
 * 显示消息
 */
function showMessage(msg: string, type: "success" | "error") {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => {
    message.value = "";
    messageType.value = "";
  }, 3000);
}

/**
 * 清空输入
 */
function handleClear() {
  inputText.value = "";
  message.value = "";
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="text-sm text-[var(--vscode-descriptionForeground)]">
      粘贴书源内容（支持 ESO JSON 格式）
    </div>

    <textarea
      v-model="inputText"
      class="min-h-[120px] w-full resize-y rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] p-2 text-sm text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)] focus:border-[var(--vscode-focusBorder)] focus:outline-none"
      placeholder="ESO JSON 格式书源"
      :disabled="importing"
    ></textarea>

    <div class="flex gap-2">
      <button
        class="flex-1 rounded bg-[var(--vscode-button-background)] px-3 py-1.5 text-sm text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
        :disabled="importing || !inputText.trim()"
        @click="handleImport"
      >
        {{ importing ? "导入中..." : "导入书源" }}
      </button>
      <button
        class="rounded bg-[var(--vscode-button-secondaryBackground)] px-3 py-1.5 text-sm text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
        @click="handleClear"
      >
        清空
      </button>
    </div>

    <!-- 消息提示 -->
    <div
      v-if="message"
      class="rounded p-2 text-sm"
      :class="{
        'bg-green-500/20 text-green-400': messageType === 'success',
        'bg-red-500/20 text-red-400': messageType === 'error',
      }"
    >
      {{ message }}
    </div>
  </div>
</template>
