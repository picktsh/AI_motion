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
  <div class="path-copy">
    <n-tooltip placement="top" :delay="300">
      <template #trigger>
        <span class="path-copy__text mono">{{ path || '—' }}</span>
      </template>
      {{ path }}
    </n-tooltip>
    <button
      class="path-copy__btn"
      type="button"
      :title="copied ? '已复制' : '复制路径'"
      @click="copy"
    >
      <n-icon :size="13">
        <CheckmarkOutline v-if="copied" />
        <CopyOutline v-else />
      </n-icon>
    </button>
  </div>
</template>

<style scoped>
.path-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.path-copy__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.path-copy__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: none;
  border: none;
  border-radius: var(--radius-tag);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: color var(--transition), background var(--transition);
}

.path-copy__btn:hover {
  color: var(--color-text-primary);
  background: var(--color-neutral-soft);
}
</style>
