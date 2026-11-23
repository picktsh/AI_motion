<script setup lang="ts">
import { ref } from 'vue';
import { NButton, NIcon, NTooltip } from 'naive-ui';
import { CopyOutline, CheckmarkOutline } from '@vicons/ionicons5';

const props = defineProps<{ path: string; inline?: boolean }>();

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
  <div class="flex items-center gap-1 min-w-0" :class="props.inline ? 'w-fit' : 'w-full'">
    <span class="min-w-0 truncate font-mono text-xs text-ink-2" :class="props.inline ? '' : 'flex-1'">{{ path || '—' }}</span>
    <NTooltip placement="top" :delay="300">
      <template #trigger>
        <NButton secondary size="tiny" circle class="flex-none" @click="copy">
          <NIcon :size="14">
            <CheckmarkOutline v-if="copied" />
            <CopyOutline v-else />
          </NIcon>
        </NButton>
      </template>
      {{ copied ? '已复制' : '复制路径' }}
    </NTooltip>
  </div>
</template>
