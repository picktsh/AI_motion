<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    rows?: number;
    /** 单行宽度，或逐行宽度数组，如 ["60%", "40%"] */
    width?: string | string[];
    height?: number;
  }>(),
  { rows: 3, width: '100%', height: 14 },
);

const widths = computed<string[]>(() => {
  const arr = Array.isArray(props.width) ? props.width : [props.width];
  return Array.from({ length: props.rows }, (_, i) => arr[i] ?? arr[arr.length - 1]);
});
</script>

<template>
  <div class="skeleton" :style="{ gap: `${Math.round(props.height / 2 + 6)}px` }">
    <div
      v-for="(w, i) in widths"
      :key="i"
      class="skeleton__row"
      :style="{ width: w, height: `${height}px` }"
    />
  </div>
</template>

<style scoped>
.skeleton {
  display: flex;
  flex-direction: column;
}

.skeleton__row {
  border-radius: var(--radius-control);
  background: var(--color-divider);
  animation: skeleton-pulse 1.2s ease-in-out infinite;
}

.skeleton__row:nth-child(2) {
  animation-delay: 0.15s;
}

.skeleton__row:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
</style>
