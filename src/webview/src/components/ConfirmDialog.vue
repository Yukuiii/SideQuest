<script setup lang="ts">
/**
 * 确认对话框组件
 * 基于 shadcn-vue Dialog 组件封装
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  /** 是否显示 */
  visible: boolean;
  /** 对话框标题 */
  title?: string;
  /** 对话框内容 */
  message: string;
  /** 确认按钮文字 */
  confirmText?: string;
  /** 取消按钮文字 */
  cancelText?: string;
  /** 确认按钮是否为危险操作样式 */
  danger?: boolean;
}

withDefaults(defineProps<Props>(), {
  title: "确认",
  confirmText: "确定",
  cancelText: "取消",
  danger: false,
});

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
  (e: "update:visible", value: boolean): void;
}>();

/**
 * 确认操作
 */
function handleConfirm() {
  emit("confirm");
  emit("update:visible", false);
}

/**
 * 取消操作
 */
function handleCancel() {
  emit("cancel");
  emit("update:visible", false);
}

/**
 * 对话框关闭时触发
 */
function handleOpenChange(open: boolean) {
  emit("update:visible", open);
  if (!open) {
    emit("cancel");
  }
}
</script>

<template>
  <Dialog :open="visible" @update:open="handleOpenChange">
    <DialogContent class="sm:max-w-[320px]">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>
          {{ message }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-2 sm:gap-0">
        <Button variant="outline" size="sm" @click="handleCancel">
          {{ cancelText }}
        </Button>
        <Button
          :variant="danger ? 'destructive' : 'default'"
          size="sm"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
