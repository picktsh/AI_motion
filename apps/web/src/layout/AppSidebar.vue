<script setup lang="ts">
import { computed, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NIcon, NMenu } from 'naive-ui';
import {
  AlbumsOutline,
  ConstructOutline,
  CubeOutline,
  DocumentTextOutline,
  FolderOpenOutline,
  HomeOutline,
  ImagesOutline,
  InformationCircleOutline,
  LogoGithub,
  MicOutline,
  TerminalOutline,
} from '@vicons/ionicons5';
import type { Component } from 'vue';
import type { MenuOption } from 'naive-ui';
import { REPO_URL } from '../shared/constants';
import { APP_VERSION } from '../shared/appMeta';

const props = withDefaults(defineProps<{
  collapsed?: boolean;
  drawer?: boolean;
}>(), {
  collapsed: false,
  drawer: false,
});

const emit = defineEmits<{ navigate: [] }>();
const route = useRoute();
const router = useRouter();
function renderMenuIcon(icon: Component) {
  return () => h(NIcon, { size: 18 }, { default: () => h(icon) });
}

const menuOptions = computed(() => router.options.routes.flatMap((item) => {
  if (!item.meta?.menu || !item.meta.icon) return [];
  const icon = item.meta.icon as Component;
  return [{
    label: item.meta.menu,
    key: item.path,
    title: item.meta.menu,
    icon: renderMenuIcon(icon),
  } satisfies MenuOption];
}));

const footerOptions: MenuOption[] = [
  {
    label: '关于我们',
    key: '/about',
    title: '关于我们',
    icon: renderMenuIcon(InformationCircleOutline),
  },
  {
    label: '更新日志',
    key: '/changelog',
    title: '更新日志',
    icon: renderMenuIcon(DocumentTextOutline),
  },
  {
    label: 'GitHub',
    key: 'external:github',
    title: 'GitHub',
    icon: renderMenuIcon(LogoGithub),
    onClick: () => window.open(REPO_URL, '_blank', 'noopener,noreferrer'),
  },
];

const selectedMenuKey = computed(() => menuOptions.value.find((option) =>
  option.key === '/' ? route.path === '/' : route.path.startsWith(String(option.key)),
)?.key as string | undefined);

const selectedFooterKey = computed(() =>
  footerOptions.some((option) => option.key === route.path) ? route.path : undefined,
);

function navigate(path: string): void {
  void router.push(path);
  emit('navigate');
}

function onSelect(key: string | number): void {
  navigate(String(key));
}

function onFooterSelect(key: string | number): void {
  if (key === 'external:github') {
    emit('navigate');
    return;
  }
  navigate(String(key));
}
</script>

<template>
  <aside
    class="relative z-20 box-border flex flex-col flex-none min-w-0 overflow-hidden p-3 transition-[width] duration-300 ease-out"
    style="border-left: 0; border-right: 0"
    :class="props.drawer
      ? 'h-full w-full rounded-none bg-panel'
      : ['glass-surface rounded-[20px]', props.collapsed ? 'w-[58px]' : 'w-60']"
  >
    <div class="flex-none">
      <div
        class="relative flex items-center h-12 cursor-pointer select-none"
        title="返回主页"
        @click="navigate('/')"
      >
        <img
          src="/brand/ai-motion-desk-icon.svg"
          alt=""
          aria-hidden="true"
          class="w-[34px] h-[34px] flex-none object-contain"
        />
        <span
          class="absolute left-[46px] text-sm font-semibold text-ink whitespace-nowrap transition-opacity duration-200"
          :class="props.collapsed ? 'opacity-0' : 'opacity-100'"
        >AI Motion Desk</span>
      </div>
    </div>

    <nav class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-4">
      <NMenu
        :options="menuOptions"
        :value="selectedMenuKey ?? null"
        :collapsed="props.collapsed"
        :collapsed-width="34"
        :collapsed-icon-size="18"
        :icon-size="18"
        :root-indent="8"
        class="sidebar-menu"
        @update:value="onSelect"
      />
    </nav>

    <footer class="flex flex-col flex-none mt-3 pt-3 border-t border-glass-border text-ink-3">
      <NMenu
        :options="footerOptions"
        :value="selectedFooterKey ?? null"
        :collapsed="props.collapsed"
        :collapsed-width="34"
        :collapsed-icon-size="18"
        :icon-size="18"
        :root-indent="8"
        class="sidebar-menu"
        @update:value="onFooterSelect"
      />
      <span class="h-[22px] px-2 text-[10px] num transition-opacity duration-200" :class="props.collapsed ? 'opacity-0' : 'opacity-100'">v{{ APP_VERSION }}</span>
    </footer>
  </aside>
</template>
