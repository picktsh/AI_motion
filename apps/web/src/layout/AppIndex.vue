<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { NDrawer, NDrawerContent } from 'naive-ui';
import { useMediaQuery } from '@vueuse/core';
import { getEnvironment } from '../api/environment';
import { useTheme } from '../theme/useTheme';
import AppContent from './AppContent.vue';
import AppHeader from './AppHeader.vue';
import AppSidebar from './AppSidebar.vue';

const route = useRoute();
const { isDark, toggle } = useTheme();
const isMobile = useMediaQuery('(max-width: 767px)');
const mobileDrawerOpen = ref(false);

const EXPANDED_KEY = 'ams-shell-expanded';
const sidebarExpanded = ref(localStorage.getItem(EXPANDED_KEY) === '1');
watch(sidebarExpanded, (value) => localStorage.setItem(EXPANDED_KEY, value ? '1' : '0'));
watch(isMobile, (mobile) => {
  if (!mobile) mobileDrawerOpen.value = false;
});

const current = computed(() => ({
  title: (route.meta.title as string) ?? 'AI Motion Desk',
  description: (route.meta.description as string) ?? '',
}));

const isGate = computed(() => route.meta.gate === true);
const summary = ref<{ ok: number; total: number } | null>(null);
const unreachable = ref(false);

async function loadSummary(): Promise<void> {
  try {
    const environment = await getEnvironment();
    summary.value = environment.summary;
    unreachable.value = false;
  } catch {
    summary.value = null;
    unreachable.value = true;
  }
}

const health = computed(() => {
  if (unreachable.value) return { tone: 'neutral' as const, text: '服务未连接' };
  if (!summary.value) return { tone: 'neutral' as const, text: '检查中' };
  if (summary.value.ok === summary.value.total) return { tone: 'success' as const, text: '环境就绪' };
  return { tone: 'danger' as const, text: `缺 ${summary.value.total - summary.value.ok} 项` };
});

const dotClass = computed(() => {
  if (health.value.tone === 'success') return 'bg-success';
  if (health.value.tone === 'danger') return 'bg-danger';
  return 'bg-ink-3';
});

const pageAlive = ref(true);
let healthTimer: number | undefined;

function handleSidebarToggle(): void {
  if (isMobile.value) {
    mobileDrawerOpen.value = true;
    return;
  }
  sidebarExpanded.value = !sidebarExpanded.value;
}

function refresh(): void {
  void loadSummary();
  pageAlive.value = false;
  void nextTick(() => {
    pageAlive.value = true;
  });
}

onMounted(() => {
  void loadSummary();
  healthTimer = window.setInterval(loadSummary, 10_000);
});

onUnmounted(() => window.clearInterval(healthTimer));
</script>

<template>
  <div v-if="isGate" class="app-canvas h-screen overflow-hidden">
    <router-view />
  </div>
  <div v-else class="app-canvas box-border flex h-screen overflow-hidden gap-3 p-4 max-md:p-3">
    <AppSidebar v-if="!isMobile" :collapsed="!sidebarExpanded" />

    <NDrawer
      v-if="isMobile"
      v-model:show="mobileDrawerOpen"
      placement="left"
      :width="280"
      :show-mask="true"
      :block-scroll="true"
    >
      <NDrawerContent :body-content-style="{ padding: '0' }">
        <AppSidebar drawer @navigate="mobileDrawerOpen = false" />
      </NDrawerContent>
    </NDrawer>

    <div class="flex-1 min-w-0 min-h-0 flex flex-col gap-3">
      <AppHeader
        :title="current.title"
        :description="current.description"
        :mobile="isMobile"
        :sidebar-expanded="sidebarExpanded"
        :is-dark="isDark"
        :health="health"
        :dot-class="dotClass"
        @toggle-sidebar="handleSidebarToggle"
        @refresh="refresh"
        @toggle-theme="toggle"
      />
      <AppContent :alive="pageAlive" />
    </div>
  </div>
</template>
