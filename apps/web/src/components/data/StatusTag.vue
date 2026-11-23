<script setup lang="ts">
import { computed } from 'vue';
import { NTag } from 'naive-ui';
import { useTheme } from '../../theme/useTheme';
import { lightPalette, darkPalette, rgba, type Palette } from '../../theme/palette';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const props = withDefaults(
  defineProps<{
    status?: StatusTone;
    text: string;
  }>(),
  { status: 'neutral' },
);

const { mode } = useTheme();

/** 底色直接取 palette 字面值给 NTag，透明度高于旧 chip，避免标签过淡。 */
const soft = computed(() => {
  const p: Palette = mode.value === 'dark' ? darkPalette : lightPalette;
  const map: Record<StatusTone, { bg: string; text: string }> = {
    success: { bg: rgba(p.success, 0.22), text: p.success },
    warning: { bg: rgba(p.warning, 0.22), text: p.warning },
    danger: { bg: rgba(p.danger, 0.22), text: p.danger },
    info: { bg: rgba(p.brand, 0.22), text: p.brand },
    neutral: { bg: rgba(p.textSecondary, 0.12), text: p.textSecondary },
  };
  return map[props.status];
});
</script>

<template>
  <NTag
    :color="{ color: soft.bg, textColor: soft.text }"
    size="small"
    :bordered="false"
    class="flex-none w-fit"
  >
    {{ text }}
  </NTag>
</template>
