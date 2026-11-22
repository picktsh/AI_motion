<script setup lang="ts">
import { computed } from 'vue';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const props = withDefaults(
  defineProps<{
    status?: StatusTone;
    text: string;
    dot?: boolean;
  }>(),
  { status: 'neutral', dot: true },
);

const toneClass = computed(() => {
  const map: Record<StatusTone, string> = {
    success: 'chip-success',
    warning: 'chip-warning',
    danger: 'chip-danger',
    info: 'chip-brand',
    neutral: 'chip-neutral',
  };
  return map[props.status];
});
</script>

<template>
  <span class="inline-flex items-center self-start flex-none gap-1 px-2 py-1 rounded-control text-xs leading-4 whitespace-nowrap w-fit" :class="toneClass">
    <span v-if="dot" class="w-2 h-2 rounded-full bg-current flex-none" />
    <span>{{ text }}</span>
  </span>
</template>
