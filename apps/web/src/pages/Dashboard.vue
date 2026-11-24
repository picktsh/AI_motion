<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue';
import { useRouter } from 'vue-router';
import { NSpin, NButton, NIcon, NCard, NEmpty } from 'naive-ui';
import { ChevronForwardOutline } from '@vicons/ionicons5';
import { listProjects, type Project } from '../api/projects';
import { listAllAssets, listRecentActivity, type GlobalAsset, type ActivityItem } from '../api/observatory';
import { listJobs } from '../api/jobs';
import type { JobSnapshot } from '../shared/types';
import { getEnvironment } from '../api/environment';

const router = useRouter();

const loading = ref(true);
const projects = ref<Project[]>([]);
const assets = ref<GlobalAsset[]>([]);
const jobs = ref<JobSnapshot[]>([]);
const activity = ref<ActivityItem[]>([]);
const envSummary = ref<{ ok: number; total: number } | null>(null);

const doneCount = computed(() => projects.value.filter((p) => p.artifactRel).length);
const activeJobs = computed(() =>
  jobs.value.filter((j) => j.status === 'queued' || j.status === 'running').length,
);

const stats = computed(() => [
  { label: '项目', value: projects.value.length, to: '/projects' },
  { label: '成片', value: doneCount.value, to: '/works' },
  { label: '素材', value: assets.value.length, to: '/assets' },
  { label: '进行中任务', value: activeJobs.value, to: '/jobs' },
]);

const KIND_META: Record<ActivityItem['kind'], { label: string; tone: string }> = {
  project: { label: '项目', tone: 'text-info' },
  artifact: { label: '成片', tone: 'text-success' },
  asset: { label: '素材', tone: 'text-ink-2' },
  job: { label: '任务', tone: 'text-warning' },
};

function ago(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  return `${day} 天前`;
}

/** 快捷入口范围白名单；文案、图标统一取路由 meta，与左侧菜单同一来源，避免两处口径漂移。 */
const SHORTCUT_PATHS = ['/projects', '/works', '/assets', '/jobs', '/templates', '/environment'];

const shortcuts = computed(() => {
  const byPath = new Map(router.options.routes.map((r) => [r.path, r]));
  return SHORTCUT_PATHS.map((path) => {
    const route = byPath.get(path);
    if (!route) return null;
    return {
      to: path,
      label: (route.meta?.menu as string) ?? (route.meta?.title as string),
      desc: (route.meta?.description as string) ?? '',
      icon: route.meta?.icon as Component,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);
});

async function load() {
  loading.value = true;
  try {
    const [p, a, j, act, env] = await Promise.all([
      listProjects().catch(() => []),
      listAllAssets().catch(() => []),
      listJobs().catch(() => []),
      listRecentActivity(20).catch(() => []),
      getEnvironment().catch(() => null),
    ]);
    projects.value = p;
    assets.value = a;
    jobs.value = j;
    activity.value = act;
    envSummary.value = env?.summary ?? null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="min-w-0">
      <h2 class="page-title">观测总览</h2>
      <p class="page-desc mt-1">这里只监测文件变动、盘点素材与产物、查看环境；创作动作在外部 AI 工具里完成后，结果会回写到工程目录。</p>
    </div>

    <NSpin :show="loading">
      <div class="flex flex-col gap-4">
        <!-- 统计 -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            v-for="s in stats"
            :key="s.label"
            class="card p-4 text-left cursor-pointer transition hover:border-brand"
            @click="router.push(s.to)"
          >
            <div class="text-xs text-ink-2">{{ s.label }}</div>
            <div class="mt-1 text-2xl font-semibold text-ink num">{{ s.value }}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- 最近动态 -->
          <NCard class="lg:col-span-2">
            <template #header>
              <div class="min-w-0">
                <h2 class="m-0 text-base font-semibold text-ink truncate">最近动态</h2>
                <p class="m-0 mt-1 text-xs text-ink-2">项目、成片、素材与后台任务的文件变更</p>
              </div>
            </template>
            <NEmpty v-if="!activity.length" description="还没有动态">
              <template #default>
                <p class="m-0 text-xs text-ink-3">项目文件或任务发生变更后会出现在这里</p>
              </template>
            </NEmpty>
            <ul v-else class="m-0 flex flex-col divide-y divide-divider">
              <li v-for="item in activity" :key="item.id" class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span class="flex-none w-12 text-xs font-medium" :class="KIND_META[item.kind].tone">
                  {{ KIND_META[item.kind].label }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm text-ink truncate">{{ item.title }}</div>
                  <div class="text-xs text-ink-2 leading-5 truncate">{{ item.detail }}</div>
                </div>
                <span class="flex-none text-xs text-ink-3 num">{{ ago(item.at) }}</span>
              </li>
            </ul>
          </NCard>

          <!-- 快捷入口 + 环境 -->
          <div class="flex flex-col gap-4">
            <NCard>
              <template #header>
                <div class="min-w-0">
                  <h2 class="m-0 text-base font-semibold text-ink truncate">快捷入口</h2>
                  <p class="m-0 mt-1 text-xs text-ink-2">按观测对象进入对应页面</p>
                </div>
              </template>
              <div class="grid grid-cols-1 gap-2">
                <NButton
                  v-for="sc in shortcuts"
                  :key="sc.to"
                  block
                  secondary
                  class="!justify-start h-15 rounded-control"
                  @click="router.push(sc.to)"
                >
                  <template #icon>
                    <NIcon :size="18" class="flex-none text-ink-2"><component :is="sc.icon" /></NIcon>
                  </template>
                  <div class="min-w-0 flex-1 text-left">
                    <div class="text-sm text-ink">{{ sc.label }}</div>
                    <div class="text-xs text-ink-3 truncate">{{ sc.desc }}</div>
                  </div>
                  <NIcon :size="14" class="flex-none text-ink-3"><ChevronForwardOutline /></NIcon>
                </NButton>
              </div>
            </NCard>

            <NCard title="运行环境">
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm text-ink-2">
                  <template v-if="envSummary">就位 {{ envSummary.ok }} / {{ envSummary.total }}</template>
                  <template v-else>检查中…</template>
                </span>
                <NButton secondary @click="router.push('/environment')">查看详情</NButton>
              </div>
            </NCard>
          </div>
        </div>
      </div>
    </NSpin>
  </div>
</template>
