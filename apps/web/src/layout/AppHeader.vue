<script setup lang="ts">
import { ref } from 'vue';
import { NButton, NDropdown, NIcon, NInput, NTooltip } from 'naive-ui';
import { useRouter } from 'vue-router';
import {
  LanguageOutline,
  MenuOutline,
  MoonOutline,
  RefreshOutline,
  SearchOutline,
  SunnyOutline,
} from '@vicons/ionicons5';

defineProps<{
  title: string;
  description: string;
  mobile: boolean;
  sidebarExpanded: boolean;
  isDark: boolean;
  health: { text: string; tone: 'neutral' | 'success' | 'danger' };
  dotClass: string;
}>();

const emit = defineEmits<{
  toggleSidebar: [];
  refresh: [];
  toggleTheme: [];
}>();

const router = useRouter();
const keyword = ref('');

function submitSearch(): void {
  const q = keyword.value.trim();
  router.push({ path: '/search', query: q ? { q } : {} });
}

const languageOptions = [
  { label: '中文', key: 'zh-CN' },
  { label: 'English', key: 'en-US', disabled: true },
];
</script>

<template>
  <header
    class="glass-surface app-header flex-none h-16 flex items-center justify-between gap-4 px-5 rounded-[20px] overflow-hidden max-sm:px-3"
  >
    <div class="flex-1 min-w-0 flex items-center gap-3">
      <n-button
        secondary
        circle
        class="flex-none"
        :title="mobile ? '打开导航菜单' : sidebarExpanded ? '折叠侧栏' : '展开侧栏'"
        @click="emit('toggleSidebar')"
      >
        <template #icon>
          <n-icon :size="18"><MenuOutline /></n-icon>
        </template>
      </n-button>
      <div class="flex flex-col gap-1 min-w-0">
        <div class="truncate whitespace-nowrap text-lg font-semibold text-ink">{{ title }}</div>
        <div v-if="description" class="truncate whitespace-nowrap text-xs text-ink-2">{{ description }}</div>
      </div>
    </div>

    <div class="flex-none flex items-center gap-2">
      <n-input
        v-model:value="keyword"
        size="small"
        round
        clearable
        placeholder="搜索项目 / 模板 / 素材"
        class="w-56 max-lg:hidden"
        @keyup.enter="submitSearch"
      />
      <n-button secondary circle aria-label="全局检索" class="lg:hidden" @click="submitSearch">
        <template #icon><n-icon :size="18"><SearchOutline /></n-icon></template>
      </n-button>
      <n-button
        secondary
        class="!h-9 !px-3 rounded-full"
        :title="health.text"
        @click="router.push('/environment')"
      >
        <span class="inline-flex items-center justify-center gap-2">
          <span class="w-2 h-2 rounded-full" :class="dotClass" />
          <span class="text-xs max-lg:hidden">{{ health.text }}</span>
        </span>
      </n-button>
      <n-dropdown :options="languageOptions" trigger="hover" placement="bottom-end" :show-arrow="true">
        <n-button secondary circle aria-label="语言：中文">
          <template #icon><n-icon :size="18"><LanguageOutline /></n-icon></template>
        </n-button>
      </n-dropdown>
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <n-button secondary circle aria-label="刷新当前页" @click="emit('refresh')">
            <template #icon><n-icon :size="18"><RefreshOutline /></n-icon></template>
          </n-button>
        </template>
        刷新当前页
      </n-tooltip>
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <n-button secondary circle :aria-label="isDark ? '切换到亮色' : '切换到暗色'" @click="emit('toggleTheme')">
            <template #icon>
              <n-icon :size="18"><component :is="isDark ? SunnyOutline : MoonOutline" /></n-icon>
            </template>
          </n-button>
        </template>
        {{ isDark ? '切换到亮色' : '切换到暗色' }}
      </n-tooltip>
    </div>
  </header>
</template>
