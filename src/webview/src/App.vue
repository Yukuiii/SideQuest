<script setup lang="ts">
import { postMessage } from './utils/vscode'

const menuItems = [
  { id: 'novel', icon: '📚', label: '阅读者', desc: 'Novel Mode - 沉浸式阅读' },
  { id: 'news', icon: '📰', label: '情报员', desc: 'News Mode - 热点聚合' },
  { id: 'market', icon: '📈', label: '操盘手', desc: 'Market Mode - 盯盘助手' },
]

function handleClick(mode: string) {
  postMessage('selectMode', { mode })
}
</script>

<template>
  <div class="container">
    <div class="welcome">
      <h2>Side Quest</h2>
      <p>主线任务交给 AI，支线任务交给你</p>
    </div>

    <div class="menu">
      <button v-for="item in menuItems" :key="item.id" class="menu-item" @click="handleClick(item.id)">
        <span class="icon">{{ item.icon }}</span>
        <div>
          <div class="label">{{ item.label }}</div>
          <div class="desc">{{ item.desc }}</div>
        </div>
      </button>
    </div>

    <div class="status">⚔️ 准备开启支线任务...</div>
  </div>
</template>

<style>
:root {
  font-family: var(--vscode-font-family, system-ui, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  padding: 0;
}
</style>

<style scoped>
.container {
  padding: 16px;
}

.welcome {
  text-align: center;
  margin-top: 20px;
}

.welcome h2 {
  margin-bottom: 8px;
  font-weight: 600;
}

.welcome p {
  color: var(--vscode-descriptionForeground);
  margin-bottom: 16px;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--vscode-button-secondaryBackground);
  border: none;
  border-radius: 6px;
  color: var(--vscode-button-secondaryForeground);
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}

.menu-item:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

.menu-item .icon {
  font-size: 18px;
}

.menu-item .label {
  font-weight: 500;
}

.menu-item .desc {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.status {
  margin-top: 20px;
  padding: 8px;
  background: var(--vscode-textBlockQuote-background);
  border-radius: 4px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}
</style>
