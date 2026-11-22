<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { getEnvironment } from '../api/environment';
import { useFetch } from '../composables/useFetch';
import SectionCard from '../components/data/SectionCard.vue';
import StatusTag from '../components/data/StatusTag.vue';
import SkeletonBlock from '../components/data/SkeletonBlock.vue';
import EmptyState from '../components/data/EmptyState.vue';
import PathCopy from '../components/data/PathCopy.vue';
import type { EnvItem } from '../shared/types';

const { data, loading, error, run } = useFetch(() => getEnvironment());

onMounted(run);

const GROUPS: { title: string; keys: string[] }[] = [
  { title: '运行时', keys: ['node', 'pnpm', 'uv'] },
  { title: '媒体工具', keys: ['ffmpeg', 'ffprobe'] },
  { title: '浏览器', keys: ['chrome'] },
  { title: '工程依赖', keys: ['nodeDeps', 'pythonVenv', 'binTools'] },
];

const items = computed<EnvItem[]>(() => data.value?.items ?? []);
const summary = computed(() => data.value?.summary ?? { ok: 0, total: 0 });
const progress = computed(() =>
  summary.value.total ? summary.value.ok / summary.value.total : 0,
);

const groups = computed(() =>
  GROUPS.map((g) => ({
    title: g.title,
    items: items.value.filter((i) => g.keys.includes(i.key)),
  })).filter((g) => g.items.length),
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <EmptyState v-if="error" tone="danger" :description="error" tip="环境信息加载失败">
      <template #action>
        <n-button type="primary" @click="run">重试</n-button>
      </template>
    </EmptyState>

    <div v-else-if="loading">
      <SkeletonBlock :rows="4" />
    </div>

    <template v-else-if="data">
      <SectionCard>
        <div class="flex flex-col gap-3">
          <div class="flex items-baseline justify-between">
            <span class="text-sm text-ink-2">依赖就位</span>
            <span class="text-xl font-semibold text-ink num">{{ summary.ok }} / {{ summary.total }}</span>
          </div>
          <div class="h-1.5 rounded-full bg-divider overflow-hidden">
            <div
              class="h-full rounded-full transition-[width] duration-150"
              :class="summary.ok === summary.total ? 'bg-success' : 'bg-warning'"
              :style="{ width: `${Math.round(progress * 100)}%` }"
            />
          </div>
          <StatusTag
            :status="summary.ok === summary.total ? 'success' : 'danger'"
            :text="summary.ok === summary.total ? '全部就位' : '有待补齐'"
          />
        </div>
      </SectionCard>

      <div v-for="g in groups" :key="g.title" class="flex flex-col gap-4">
        <SectionCard :title="g.title">
          <div class="flex flex-col">
            <div
              v-for="item in g.items"
              :key="item.key"
              class="flex flex-col gap-2 py-2 border-b border-divider last:border-b-0"
              :class="!item.ok ? 'p-3 border border-danger rounded-control bg-danger-soft' : ''"
            >
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full flex-none" :class="item.ok ? 'bg-success' : 'bg-danger'" />
                <span class="text-sm font-medium text-ink">{{ item.label }}</span>
                <span class="text-xs text-ink-2 num">{{ item.version || '—' }}</span>
                <StatusTag
                  class="ml-auto"
                  :status="item.ok ? 'success' : 'danger'"
                  :text="item.ok ? '就位' : '缺失'"
                />
              </div>
              <div class="pl-4">
                <PathCopy :path="item.path || '—'" />
              </div>
              <div v-if="!item.ok && item.hint" class="flex items-center gap-2 pl-4 text-xs text-danger">
                <span class="flex-none text-ink-3">提示</span>
                <PathCopy :path="item.hint" />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <EmptyState v-if="!items.length" description="未检测到环境项" />
    </template>
  </div>
</template>

