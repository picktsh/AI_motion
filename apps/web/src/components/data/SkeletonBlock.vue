<script setup lang="ts">
import { NSkeleton } from 'naive-ui';

withDefaults(
  defineProps<{
    rows?: number;
    /** 单行宽度 */
    width?: string;
    height?: number;
  }>(),
  { rows: 3, width: '100%', height: 16 },
);
</script>

<template>
  <NSkeleton class="w-full" text :repeat="rows" :width="width" :height="height" />
</template>
