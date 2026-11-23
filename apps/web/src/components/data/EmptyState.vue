<script setup lang="ts">
import { computed } from 'vue';
import { NEmpty, NIcon } from 'naive-ui';
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

/** danger 态图标标红；底色沿用 NEmpty 默认浅圆。 */
const iconTone = computed(() => (props.tone === 'danger' ? 'text-danger' : 'text-ink-3'));
</script>

<template>
  <div :class="boxed ? 'card min-h-80 px-5 py-10 flex flex-col items-center justify-center' : ''">
    <NEmpty :title="title || undefined" :description="description">
      <template #icon>
        <NIcon :class="iconTone">
          <slot name="icon"><FolderOpenOutline /></slot>
        </NIcon>
      </template>
      <template #default>
        <div class="flex flex-col items-center gap-2">
          <p v-if="tip" class="m-0 text-xs text-ink-3">{{ tip }}</p>
          <div v-if="$slots.action" class="flex items-center gap-2">
            <slot name="action" />
          </div>
        </div>
      </template>
    </NEmpty>
  </div>
</template>
