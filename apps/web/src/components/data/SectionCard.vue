<script setup lang="ts">
import { computed } from 'vue';
import { NCard } from 'naive-ui';

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    padded?: boolean;
  }>(),
  { title: '', subtitle: '', padded: true },
);

const contentStyle = computed(() => (props.padded ? 'padding: 16px 20px;' : 'padding: 0;'));
/** header 默认左右 24px，与 body 的 20px 错位；这里对齐到同一内边距。 */
const headerStyle = computed(() => (props.padded ? 'padding: 16px 20px;' : 'padding: 0;'));
</script>

<template>
  <NCard :content-style="contentStyle" :header-style="headerStyle" class="overflow-hidden">
    <template v-if="title || subtitle || $slots.extra" #header>
      <div class="min-w-0">
        <h2 v-if="title" class="m-0 text-lg font-semibold text-ink truncate">{{ title }}</h2>
        <p v-if="subtitle" class="m-0 mt-1 text-xs text-ink-2">{{ subtitle }}</p>
      </div>
    </template>
    <template #header-extra>
      <div v-if="$slots.extra" class="flex items-center gap-2 flex-none">
        <slot name="extra" />
      </div>
    </template>
    <slot />
  </NCard>
</template>
