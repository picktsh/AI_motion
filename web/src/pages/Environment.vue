<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { getEnvironment } from '../api/env';
import { useFetch } from '../composables/useFetch';
import SectionCard from '../components/SectionCard.vue';
import StatusTag from '../components/StatusTag.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import EmptyState from '../components/EmptyState.vue';
import PathCopy from '../components/PathCopy.vue';
import type { EnvItem } from '../types';

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
  <div class="environment">
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
        <div class="overview">
          <div class="overview__head">
            <span class="overview__title">依赖就位</span>
            <span class="overview__value tnum">{{ summary.ok }} / {{ summary.total }}</span>
          </div>
          <div class="overview__bar">
            <div
              class="overview__fill"
              :class="summary.ok === summary.total ? 'overview__fill--ok' : 'overview__fill--warn'"
              :style="{ width: `${Math.round(progress * 100)}%` }"
            />
          </div>
          <StatusTag
            :status="summary.ok === summary.total ? 'success' : 'danger'"
            :text="summary.ok === summary.total ? '全部就位' : '有待补齐'"
          />
        </div>
      </SectionCard>

      <div v-for="g in groups" :key="g.title" class="group">
        <SectionCard :title="g.title">
          <div class="rows">
            <div v-for="item in g.items" :key="item.key" class="row" :class="{ 'row--missing': !item.ok }">
              <div class="row__main">
                <span class="row__dot" :class="item.ok ? 'row__dot--ok' : 'row__dot--danger'" />
                <span class="row__name">{{ item.label }}</span>
                <span class="row__version tnum">{{ item.version || '—' }}</span>
                <StatusTag
                  class="row__status"
                  :status="item.ok ? 'success' : 'danger'"
                  :text="item.ok ? '就位' : '缺失'"
                />
              </div>
              <div class="row__path">
                <PathCopy :path="item.path || '—'" />
              </div>
              <div v-if="!item.ok && item.hint" class="row__hint">
                <span class="row__hint-label">提示</span>
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

<style scoped>
.environment {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.overview__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.overview__title {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.overview__value {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.overview__bar {
  height: 6px;
  border-radius: 999px;
  background: var(--color-divider);
  overflow: hidden;
}

.overview__fill {
  height: 100%;
  border-radius: 999px;
  transition: width var(--transition);
}

.overview__fill--ok {
  background: var(--color-success);
}

.overview__fill--warn {
  background: var(--color-warning);
}

.rows {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-divider);
}

.row:last-child {
  border-bottom: none;
}

.row--missing {
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--color-danger) 24%, transparent);
  border-radius: var(--radius-control);
  background: var(--color-danger-soft);
}

.row__main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.row__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.row__dot--ok {
  background: var(--color-success);
}

.row__dot--danger {
  background: var(--color-danger);
}

.row__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.row__version {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.row__status {
  margin-left: auto;
}

.row__path {
  padding-left: 18px;
}

.row__hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 18px;
  font-size: 12px;
  color: var(--color-danger);
}

.row__hint-label {
  flex: none;
  color: var(--color-text-tertiary);
}
</style>
