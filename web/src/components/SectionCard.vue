<script setup lang="ts">
defineProps<{
  title?: string;
  padded?: boolean;
}>();
</script>

<template>
  <section class="section-card">
    <header v-if="title || $slots.extra" class="section-card__header">
      <h2 v-if="title" class="section-card__title">{{ title }}</h2>
      <div v-if="$slots.extra" class="section-card__extra">
        <slot name="extra" />
      </div>
    </header>
    <div class="section-card__body" :class="{ 'section-card__body--padded': padded !== false }">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.section-card {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.section-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px 0;
}

.section-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: var(--color-text-primary);
}

.section-card__extra {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-card__body {
  padding: 16px 20px 20px;
}

.section-card__body--padded {
  padding: 16px 20px 20px;
}
</style>
