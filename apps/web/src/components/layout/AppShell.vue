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

const dotColor = computed(() => {
  if (health.value.tone === 'success') return 'var(--color-success)';
  if (health.value.tone === 'danger') return 'var(--color-danger)';
  return 'var(--color-text-tertiary)';
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

/* 健康灯定时轮询：后端重启或恢复后，无需手动刷新即回到已连接态 */
let healthTimer: number | undefined;

onMounted(() => {
  void loadSummary();
  healthTimer = window.setInterval(loadSummary, 10_000);
});

onUnmounted(() => window.clearInterval(healthTimer));
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <aside
      class="flex flex-col flex-none min-w-0 bg-[var(--color-panel)] border-r border-[var(--color-border)] transition-[width] duration-150"
      :class="collapsed ? 'w-[50px]' : 'w-60'"
    >
      <div class="px-2 pt-2 flex-none">
        <div
          class="flex items-center gap-2 h-16 px-2 cursor-pointer select-none"
          title="返回主页"
          @click="goHome"
        >
          <n-icon :size="18" class="flex-none text-[var(--color-brand)]">
            <ApertureOutline />
          </n-icon>
          <span
            v-show="!collapsed"
            class="truncate whitespace-nowrap text-base font-semibold text-[var(--color-text-primary)]"
          >
            AI Motion Studio
          </span>
        </div>
      </div>

      <nav class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-1 px-2 py-2">
        <button
          v-for="opt in menuOptions"
          :key="opt.key"
          type="button"
          class="flex items-center w-full px-2 py-2 gap-2 leading-none rounded-lg border-0 bg-transparent text-[var(--color-text-secondary)] cursor-pointer transition-colors hover:bg-[var(--color-neutral-soft)] hover:text-[var(--color-text-primary)]"
          :class="{ 'nav-item--active': isActive(opt.key) }"
          @click="onSelect(opt.key)"
        >
          <span class="w-[18px] flex-none flex items-center justify-center">
            <n-icon :size="18">
              <component :is="opt.icon" />
            </n-icon>
          </span>
          <span v-show="!collapsed" class="flex-1 min-w-0 text-left truncate text-sm leading-none">
            {{ opt.label }}
          </span>
        </button>
      </nav>
    </aside>

    <div class="flex-1 min-w-0 min-h-0 flex flex-col">
      <header
        class="flex-none h-16 flex items-center justify-between gap-3 px-6 bg-[var(--color-panel)] border-b border-[var(--color-border)] overflow-hidden"
      >
        <div class="flex-1 min-w-0 flex items-center gap-3">
          <n-button
            quaternary
            circle
            class="p-2 flex-none"
            :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
            @click="collapsed = !collapsed"
          >
            <template #icon>
              <n-icon :size="18">
                <MenuOutline />
              </n-icon>
            </template>
          </n-button>
          <div class="flex flex-col gap-0.5 min-w-0">
            <div class="truncate whitespace-nowrap text-[15px] font-semibold text-[var(--color-text-primary)]">
              {{ current.title }}
            </div>
            <div
              v-if="current.description"
              class="truncate whitespace-nowrap text-xs text-[var(--color-text-secondary)]"
            >
              {{ current.description }}
            </div>
          </div>
        </div>

        <div class="flex-none flex items-center gap-2">
          <button
            type="button"
            class="p-2 inline-flex items-center justify-center bg-transparent border-0 rounded-lg cursor-pointer transition-colors hover:bg-[var(--color-neutral-soft)]"
            :title="health.text"
            aria-label="环境状态，点击查看环境检查"
            @click="router.push('/environment')"
          >
            <span class="w-[18px] h-[18px] inline-flex items-center justify-center">
              <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: dotColor }" />
            </span>
          </button>
          <n-button quaternary circle class="p-2" title="刷新当前页" @click="refresh">
            <template #icon>
              <n-icon :size="18">
                <RefreshOutline />
              </n-icon>
            </template>
          </n-button>
          <n-button
            quaternary
            circle
            class="p-2"
            :title="isDark ? '切换到亮色' : '切换到暗色'"
            @click="toggle"
          >
            <template #icon>
              <n-icon :size="18">
                <component :is="isDark ? SunnyOutline : MoonOutline" />
              </n-icon>
            </template>
          </n-button>
        </div>
      </header>

      <main class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-6">
        <div v-if="pageAlive" class="max-w-[1440px] mx-auto">
          <router-view v-slot="{ Component }">
            <Transition name="page" mode="out-in">
              <component :is="Component" :key="route.path" />
            </Transition>
          </router-view>
        </div>
      </main>

      <AppFooter />
    </div>
  </div>
</template>

<style scoped>
/* 菜单选中态：不依赖 UnoCSS 任意值解析，直接吃主题变量 */
.nav-item--active {
  background: var(--color-brand-soft);
  color: var(--color-brand);
}

/* 页面切换过渡动画 */
.page-enter-active,
.page-leave-active {
  transition: opacity var(--transition);
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
