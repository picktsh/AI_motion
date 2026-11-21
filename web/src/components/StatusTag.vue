<script setup lang="ts">
export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

withDefaults(
  defineProps<{
    status?: StatusTone;
    text: string;
    dot?: boolean;
  }>(),
  { status: 'neutral', dot: true },
);
</script>

<template>
  <span class="status-tag" :class="`status-tag--${status}`">
    <span v-if="dot" class="status-tag__dot" />
    <span class="status-tag__text">{{ text }}</span>
  </span>
</template>

<style scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  flex: none;
  gap: 6px;
  padding: 2px 10px;
  border-radius: var(--radius-tag);
  font-size: 12px;
  line-height: 20px;
  border: 1px solid transparent;
  white-space: nowrap;
  width: fit-content;
}

.status-tag__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}

.status-tag--success {
  color: var(--color-success);
  background: var(--color-success-soft);
  border-color: color-mix(in srgb, var(--color-success) 28%, transparent);
}

.status-tag--warning {
  color: var(--color-warning);
  background: var(--color-warning-soft);
  border-color: color-mix(in srgb, var(--color-warning) 28%, transparent);
}

.status-tag--danger {
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-color: color-mix(in srgb, var(--color-danger) 28%, transparent);
}

.status-tag--info {
  color: var(--color-brand);
  background: var(--color-brand-soft);
  border-color: color-mix(in srgb, var(--color-brand) 28%, transparent);
}

.status-tag--neutral {
  color: var(--color-text-secondary);
  background: var(--color-neutral-soft);
  border-color: var(--color-border);
}
</style>
