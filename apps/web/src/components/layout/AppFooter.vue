<script setup lang="ts">
import { useRouter } from 'vue-router';
import { NIcon } from 'naive-ui';
import { InformationCircleOutline, DocumentTextOutline } from '@vicons/ionicons5';
import { REPO_URL } from '../../shared/constants';

const router = useRouter();
const VERSION = '0.1.0';
</script>

<template>
  <footer class="flex-none box-border h-12 flex items-center justify-between gap-4 flex-nowrap px-6 border-t border-border bg-panel">
    <div class="flex items-center gap-2 min-w-0 text-xs">
      <span class="font-semibold text-ink">AI Motion Studio</span>
      <span class="text-ink-3">·</span>
      <span class="text-ink-2 num">v{{ VERSION }}</span>
    </div>

    <nav class="flex items-center gap-4">
      <button type="button" class="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs text-ink-2 cursor-pointer no-underline transition-colors duration-150 hover:text-brand" @click="router.push('/about')">
        <n-icon :size="14"><InformationCircleOutline /></n-icon>
        关于我们
      </button>
      <button type="button" class="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs text-ink-2 cursor-pointer no-underline transition-colors duration-150 hover:text-brand" @click="router.push('/changelog')">
        <n-icon :size="14"><DocumentTextOutline /></n-icon>
        更新日志
      </button>
      <a class="inline-flex items-center gap-1 text-xs text-ink-2 no-underline transition-colors duration-150 hover:text-brand" :href="REPO_URL" target="_blank" rel="noopener noreferrer">
        GitHub
      </a>
    </nav>
  </footer>
</template>
