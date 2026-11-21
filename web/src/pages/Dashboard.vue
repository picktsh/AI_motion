<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getJson } from '../api/client';
import { useFetch } from '../composables/useFetch';
import StatCard from '../components/StatCard.vue';
import SectionCard from '../components/SectionCard.vue';
import StatusTag from '../components/StatusTag.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import EmptyState from '../components/EmptyState.vue';
import PathCopy from '../components/PathCopy.vue';
import type {
  EnvReport,
  EnvItem,
  TemplateSummary,
  VideoSummary,
  Segment,
} from '../types';

const router = useRouter();
const backendOrigin = import.meta.env.VITE_SERVER_ORIGIN;

const { data, loading, error, run } = useFetch(async () => {
  const [env, t, v, s] = await Promise.all([
    getJson<EnvReport>('/environment'),
    getJson<{ items: TemplateSummary[] }>('/templates'),
    getJson<{ items: VideoSummary[] }>('/videos'),
    getJson<{ items: Segment[] }>('/tts/segments'),
  ]);
  return { env, tpls: t.items, vids: v.items, segs: s.items };
});

onMounted(run);

const envItems = computed<EnvItem[]>(() => data.value?.env.items ?? []);
const envSummary = computed(() => data.value?.env.summary ?? null);
const abnormal = computed(() => envItems.value.filter((i) => !i.ok).slice(0, 3));
const allOk = computed(
  () => !!envSummary.value && envSummary.value.ok === envSummary.value.total,
);
const healthProgress = computed(() => {
  if (!envSummary.value || !envSummary.value.total) return 0;
  return envSummary.value.ok / envSummary.value.total;
});
</script>

<template>
  <!-- 错误态 -->
  <EmptyState
    v-if="error"
    tone="danger"
    :description="error"
    :tip="`请确认后端服务已启动（${backendOrigin}）`"
  >
    <template #action>
      <n-button type="primary" @click="run">重试</n-button>
    </template>
  </EmptyState>

  <!-- 骨架加载态 -->
  <div v-else-if="loading" class="dashboard">
    <div class="stat-grid">
      <SectionCard v-for="i in 4" :key="i">
        <SkeletonBlock :rows="2" :height="18" />
      </SectionCard>
    </div>
    <SectionCard title="最近产物">
      <SkeletonBlock :rows="3" />
    </SectionCard>
  </div>

  <!-- 正常态 -->
  <div v-else-if="data" class="dashboard">
    <div class="stat-grid">
      <StatCard
        label="依赖健康"
        :value="envSummary?.ok ?? 0"
        :suffix="`/ ${envSummary?.total ?? 0}`"
        :progress="healthProgress"
        :tone="allOk ? 'success' : 'warning'"
        :hint="allOk ? '全部依赖就位' : `${abnormal.length} 项待补齐`"
        to="/environment"
      />
      <StatCard label="本地模板" :value="data.tpls.length" tone="brand" hint="MotionGit 模板包" to="/templates" />
      <StatCard label="视频条目" :value="data.vids.length" tone="cyan" hint="制作工程与产物" to="/videos" />
      <StatCard label="配音分段" :value="data.segs.length" tone="neutral" hint="TTS 词边界" to="/tts" />
    </div>

    <SectionCard title="最近产物">
      <div v-if="data.vids.length" class="thumb-wall">
        <button
          v-for="v in data.vids"
          :key="v.id"
          class="thumb"
          type="button"
          @click="router.push('/videos')"
        >
          <div class="thumb__media">
            <img v-if="v.preview?.url" :src="v.preview.url" :alt="v.title" />
            <div v-else class="thumb__placeholder">暂无预览</div>
          </div>
          <div class="thumb__meta">
            <div class="thumb__title">{{ v.title }}</div>
            <div class="thumb__sub tnum">{{ v.duration ?? '—' }}s · {{ v.sceneCount }} 场景</div>
          </div>
        </button>
      </div>
      <EmptyState v-else description="暂无视频条目" />
    </SectionCard>

    <SectionCard title="环境速览">
      <div v-if="abnormal.length" class="abnormal-list">
        <div v-for="item in abnormal" :key="item.key" class="abnormal">
          <StatusTag status="danger" :text="item.label" />
          <PathCopy :path="item.path ?? item.hint ?? '—'" />
        </div>
      </div>
      <div v-else class="all-ok">
        <StatusTag status="success" text="全部就位" />
        <span class="all-ok__sub">依赖项均已检测到可用版本</span>
      </div>
    </SectionCard>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

/* 缩略图墙 */
.thumb-wall {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.thumb {
  width: 200px;
  flex: none;
  padding: 0;
  text-align: left;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--transition);
}

.thumb:hover {
  border-color: var(--color-brand);
}

.thumb__media {
  aspect-ratio: 16 / 9;
  background: var(--color-divider);
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumb__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb__placeholder {
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.thumb__meta {
  padding: 10px 12px;
}

.thumb__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thumb__sub {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

/* 环境速览 */
.abnormal-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.abnormal {
  display: flex;
  align-items: center;
  gap: 12px;
}

.all-ok {
  display: flex;
  align-items: center;
  gap: 10px;
}

.all-ok__sub {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
