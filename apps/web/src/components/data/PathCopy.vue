<script setup lang="ts">
import { ref } from 'vue';
import { NIcon } from 'naive-ui';
import { CopyOutline, CheckmarkOutline } from '@vicons/ionicons5';

const props = defineProps<{ path: string }>();

const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(props.path);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = props.path;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  copied.value = true;
  window.setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <div class="flex items-center gap-1 min-w-0 w-full">
    <n-tooltip placement="top" :delay="300">
      <template #trigger>
        <span class="flex-1 min-w-0 truncate font-mono text-xs text-ink-2">{{ path || '—' }}</span>
      </template>
      {{ path }}
    </n-tooltip>
    <button
      class="flex items-center justify-center w-6 h-6 flex-none border-0 rounded-control bg-transparent text-ink-3 cursor-pointer transition-colors duration-150 hover:text-ink hover:bg-neutral-soft"
      type="button"
      :title="copied ? '已复制' : '复制路径'"
      @click="copy"
    >
      <n-icon :size="14">
        <CheckmarkOutline v-if="copied" />
        <CopyOutline v-else />
      </n-icon>
    </button>
  </div>
</template>
