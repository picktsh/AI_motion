<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    rows?: number;
    /** 单行宽度，或逐行宽度数组，如 ["60%", "40%"] */
    width?: string | string[];
    height?: number;
  }>(),
  { rows: 3, width: '100%', height: 16 },
);

const widths = computed<string[]>(() => {
  const arr = Array.isArray(props.width) ? props.width : [props.width];
  return Array.from({ length: props.rows }, (_, i) => arr[i] ?? arr[arr.length - 1]);
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="(w, i) in widths"
      :key="i"
      class="rounded-control bg-divider animate-pulse"
      :style="{ width: w, height: `${height}px`, animationDelay: `${i * 150}ms` }"
    />
  </div>
</template>
