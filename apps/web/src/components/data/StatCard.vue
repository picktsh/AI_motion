<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'cyan' | 'neutral';

const router = useRouter();

const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    suffix?: string;
    hint?: string;
    tone?: Tone;
    /** 0 ~ 1，给出后显示底部占比条 */
    progress?: number;
    /** 给出后卡片可点击跳转到该路由 */
    to?: string;
  }>(),
  { tone: 'brand', suffix: '', hint: '', progress: undefined, to: undefined },
);

function onClick() {
  if (props.to) router.push(props.to);
}

const progressStyle = computed(() => {
  if (props.progress === undefined || props.progress === null) return {};
  const p = Math.max(0, Math.min(1, props.progress));
  return { width: `${Math.round(p * 100)}%` };
});

const barColor = computed(() => `var(--color-${props.tone === 'neutral' ? 'text-tertiary' : props.tone})`);
</script>

<template>
  <div
    class="card flex flex-col gap-2 px-5 py-4 min-h-28"
    :class="to ? 'cursor-pointer transition duration-150 hover:border-brand hover:-translate-y-px' : ''"
    :role="to ? 'button' : undefined"
    :tabindex="to ? 0 : undefined"
    @click="onClick"
    @keydown.enter="onClick"
  >
    <div class="text-xs text-ink-2">{{ label }}</div>
    <div class="flex items-baseline gap-1">
      <span class="text-4xl font-semibold leading-8 text-ink num">{{ value }}</span>
      <span v-if="suffix" class="text-sm text-ink-2">{{ suffix }}</span>
    </div>
    <div v-if="progress !== undefined" class="h-1 rounded-full bg-divider overflow-hidden">
      <div class="h-full rounded-full transition-[width] duration-150" :style="{ width: progressStyle.width, background: barColor }" />
    </div>
    <div v-if="hint" class="text-xs text-ink-3">{{ hint }}</div>
  </div>
</template>
