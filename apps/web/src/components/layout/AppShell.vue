<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NIcon, NButton } from 'naive-ui';
import {
  MenuOutline,
  RefreshOutline,
  SunnyOutline,
  MoonOutline,
  ApertureOutline,
} from '@vicons/ionicons5';
import type { Component } from 'vue';
import { getEnvironment } from '../../api/environment';
import { useTheme } from '../../theme/useTheme';
import AppFooter from './AppFooter.vue';

const route = useRoute();
const router = useRouter();
const { isDark, toggle } = useTheme();

const SHELL_COLLAPSED_KEY = 'ams-shell-collapsed';
const collapsed = ref(localStorage.getItem(SHELL_COLLAPSED_KEY) === '1');
watch(collapsed, (v) => localStorage.setItem(SHELL_COLLAPSED_KEY, v ? '1' : '0'));

const current = computed(() => ({
  title: (route.meta.title as string) ?? 'AI Motion Studio',
  description: (route.meta.description as string) ?? '',
}));

const isGate = computed(() => route.meta.gate === true);

const menuOptions = computed(() =>
  router.options.routes
    .filter((r) => r.meta?.menu)
    .map((r) => ({
      label: r.meta?.menu as string,
      key: r.path,
      icon: r.meta?.icon as Component,
    })),
);

function isActive(key: string): boolean {
  return key === '/' ? route.path === '/' : route.path.startsWith(key);
}

/** 选中/未选中各给完整类，避免 bg-transparent 与条件底色叠加的 cascade 坑。 */
function navClass(key: string): string {
  return isActive(key)
    ? 'bg-brand-soft text-brand'
    : 'text-ink-2 hover:bg-neutral-soft hover:text-ink';
}

function onSelect(key: string) {
  router.push(key);
}

function goHome() {
  router.push('/');
}

/* 顶栏环境健康灯 */
const summary = ref<{ ok: number; total: number } | null>(null);
const unreachable = ref(false);

async function loadSummary() {
  try {
    const env = await getEnvironment();
    summary.value = env.summary;
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

/* 刷新：卸载再挂载当前页，页面按 onMounted 重新初始化拉取，与页面解耦 */
const pageAlive = ref(true);
function refresh() {
  void loadSummary();
  pageAlive.value = false;
  void nextTick(() => {
    pageAlive.value = true;
  });
}

let healthTimer: number | undefined;

onMounted(() => {
  void loadSummary();
  healthTimer = window.setInterval(loadSummary, 10_000);
});

onUnmounted(() => window.clearInterval(healthTimer));
</script>

<template>
  <div v-if="isGate" class="h-screen overflow-hidden">
      <router-view />
    </div>
    <div v-else class="flex h-screen overflow-hidden">
    <aside
      class="flex flex-col flex-none min-w-0 bg-panel border-r border-border transition-[width] duration-150"
      :class="collapsed ? 'w-12' : 'w-60'"
    >
      <div class="px-2 pt-2 flex-none">
        <div
          class="flex items-center gap-2 h-16 px-2 cursor-pointer select-none"
          title="返回主页"
          @click="goHome"
        >
          <n-icon :size="18" class="flex-none text-brand">
            <ApertureOutline />
          </n-icon>
          <span v-show="!collapsed" class="truncate whitespace-nowrap text-lg font-semibold text-ink">
            AI Motion Studio
          </span>
        </div>
      </div>

      <nav class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-1 px-2 py-2">
      <n-button
        v-for="opt in menuOptions"
        :key="opt.key"
        block
        secondary
        class="!px-2 !py-2 rounded-control justify-start"
        :class="navClass(opt.key)"
        @click="onSelect(opt.key)"
      >
        <template #icon>
          <span class="w-5 flex-none flex items-center justify-center">
            <n-icon :size="18">
              <component :is="opt.icon" />
            </n-icon>
          </span>
        </template>
        <span v-show="!collapsed" class="flex-1 min-w-0 text-left truncate text-sm leading-none">
          {{ opt.label }}
        </span>
      </n-button>
      </nav>
    </aside>

    <div class="flex-1 min-w-0 min-h-0 flex flex-col">
      <header
        class="flex-none h-16 flex items-center justify-between gap-4 px-6 bg-panel border-b border-border overflow-hidden"
      >
        <div class="flex-1 min-w-0 flex items-center gap-3">
          <n-button
            secondary
            circle
            class="flex-none"
            :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
            @click="collapsed = !collapsed"
          >
            <template #icon>
              <n-icon :size="18">
                <MenuOutline />
              </n-icon>
            </template>
          </n-button>
          <div class="flex flex-col gap-1 min-w-0">
            <div class="truncate whitespace-nowrap text-lg font-semibold text-ink">
              {{ current.title }}
            </div>
            <div v-if="current.description" class="truncate whitespace-nowrap text-xs text-ink-2">
              {{ current.description }}
            </div>
          </div>
        </div>

        <div class="flex-none flex items-center gap-2">
          <n-button
            circle
            secondary
            :title="health.text"
            aria-label="环境状态，点击查看环境检查"
            @click="router.push('/environment')"
          >
            <span class="w-5 h-5 inline-flex items-center justify-center">
              <span class="w-2 h-2 rounded-full" :class="dotClass" />
            </span>
          </n-button>
          <n-button secondary circle title="刷新当前页" @click="refresh">
            <template #icon>
              <n-icon :size="18">
                <RefreshOutline />
              </n-icon>
            </template>
          </n-button>
          <n-button secondary circle :title="isDark ? '切换到亮色' : '切换到暗色'" @click="toggle">
            <template #icon>
              <n-icon :size="18">
                <component :is="isDark ? SunnyOutline : MoonOutline" />
              </n-icon>
            </template>
          </n-button>
        </div>
      </header>

      <main class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-6">
        <div v-if="pageAlive" class="max-w-screen-2xl mx-auto">
          <router-view v-slot="{ Component }">
            <Transition
              mode="out-in"
              enter-active-class="transition-opacity duration-150"
              enter-from-class="opacity-0"
              leave-active-class="transition-opacity duration-150"
              leave-to-class="opacity-0"
            >
              <component :is="Component" :key="route.path" />
            </Transition>
          </router-view>
        </div>
      </main>

      <AppFooter />
    </div>
  </div>
</template>
