<script setup lang="ts">
defineProps<{ alive: boolean }>();
</script>

<template>
  <main class="app-content flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden rounded-[24px] px-5 py-5 max-sm:px-3 max-sm:py-3">
    <div v-if="alive" class="max-w-screen-2xl mx-auto">
      <router-view v-slot="{ Component }">
        <Transition
          mode="out-in"
          enter-active-class="transition-opacity duration-150"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-150"
          leave-to-class="opacity-0"
        >
          <component :is="Component" :key="$route.path" />
        </Transition>
      </router-view>
    </div>
  </main>
</template>
