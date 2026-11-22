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
    class="stat-card"
    :class="{ 'stat-card--link': to }"
    :role="to ? 'button' : undefined"
    :tabindex="to ? 0 : undefined"
    @click="onClick"
    @keydown.enter="onClick"
  >
    <div class="stat-card__label">{{ label }}</div>
    <div class="stat-card__value-row">
      <span class="stat-card__value tnum">{{ value }}</span>
      <span v-if="suffix" class="stat-card__suffix">{{ suffix }}</span>
    </div>
    <div v-if="progress !== undefined" class="stat-card__bar">
      <div class="stat-card__bar-fill" :style="{ width: progressStyle.width, background: barColor }" />
    </div>
    <div v-if="hint" class="stat-card__hint">{{ hint }}</div>
  </div>
</template>

<style scoped>
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 20px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  min-height: 112px;
}

.stat-card--link {
  cursor: pointer;
  transition: border-color var(--transition), transform var(--transition),
    box-shadow var(--transition);
}

.stat-card--link:hover {
  border-color: var(--color-brand);
  transform: translateY(-1px);
}

.stat-card__label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.stat-card__value-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat-card__value {
  font-size: 28px;
  font-weight: 600;
  line-height: 32px;
  color: var(--color-text-primary);
}

.stat-card__suffix {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.stat-card__bar {
  height: 4px;
  border-radius: 999px;
  background: var(--color-divider);
  overflow: hidden;
}

.stat-card__bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width var(--transition);
}

.stat-card__hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
</style>
