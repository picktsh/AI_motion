<script setup lang="ts">
import { computed } from 'vue';
import { FolderOpenOutline } from '@vicons/ionicons5';

const props = withDefaults(
  defineProps<{
    description: string;
    title?: string;
    tip?: string;
    tone?: 'neutral' | 'danger';
    boxed?: boolean;
  }>(),
  { title: '', tone: 'neutral', tip: '', boxed: false },
);

const iconClass = computed(() =>
  props.tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-neutral-soft text-ink-3',
);
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center"
    :class="boxed ? 'card min-h-80' : ''"
  >
    <div class="flex items-center justify-center w-11 h-11 rounded-full mb-1" :class="iconClass">
      <slot name="icon">
        <n-icon :size="22">
          <FolderOpenOutline />
        </n-icon>
      </slot>
    </div>
    <p v-if="title" class="m-0 text-sm font-semibold text-ink">{{ title }}</p>
    <p class="m-0 text-sm text-ink-2">{{ description }}</p>
    <p v-if="tip" class="m-0 text-xs text-ink-3">{{ tip }}</p>
    <div v-if="$slots.action" class="mt-2 flex items-center gap-2">
      <slot name="action" />
    </div>
  </div>
</template>
