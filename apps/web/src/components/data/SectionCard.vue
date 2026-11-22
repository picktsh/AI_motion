<script setup lang="ts">
defineProps<{
  title?: string;
  subtitle?: string;
  padded?: boolean;
}>();
</script>

<template>
  <section class="card overflow-hidden">
    <header v-if="title || $slots.extra" class="row-between px-5 pt-4">
      <div class="min-w-0">
        <h2 v-if="title" class="m-0 text-lg font-semibold text-ink truncate">{{ title }}</h2>
        <p v-if="subtitle" class="m-0 mt-1 text-xs text-ink-2">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.extra" class="flex items-center gap-2 flex-none">
        <slot name="extra" />
      </div>
    </header>
    <div :class="padded !== false ? 'px-5 py-4' : ''">
      <slot />
    </div>
  </section>
</template>
