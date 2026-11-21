<script setup lang="ts">
import { FolderOpenOutline } from '@vicons/ionicons5';

withDefaults(
  defineProps<{
    description: string;
    tip?: string;
    tone?: 'neutral' | 'danger';
    boxed?: boolean;
  }>(),
  { tone: 'neutral', tip: '', boxed: false },
);
</script>

<template>
  <div class="empty-state" :class="[`empty-state--${tone}`, { 'empty-state--boxed': boxed }]">
    <div class="empty-state__icon">
      <slot name="icon">
        <n-icon :size="22">
          <FolderOpenOutline />
        </n-icon>
      </slot>
    </div>
    <p class="empty-state__desc">{{ description }}</p>
    <p v-if="tip" class="empty-state__tip">{{ tip }}</p>
    <div v-if="$slots.action" class="empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  text-align: center;
}

.empty-state--boxed {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  min-height: 320px;
}

.empty-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-neutral-soft);
  color: var(--color-text-tertiary);
  margin-bottom: 4px;
}

.empty-state--danger .empty-state__icon {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.empty-state__desc {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.empty-state__tip {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.empty-state__action {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
