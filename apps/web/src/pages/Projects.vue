<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NTag, NSpin, NCard, NEmpty } from 'naive-ui';
import { listProjects, type Project } from '../api/projects';
import { onDomain } from '../api/events';

const router = useRouter();
const items = ref<Project[]>([]);
const loading = ref(true);
const error = ref('');

const statusText: Record<Project['status'], string> = {
  draft: '待报价',
  quoted: '已报价',
  running: '生成中',
  failed: '失败',
  done: '已成片',
};

const statusType: Record<Project['status'], 'default' | 'info' | 'warning' | 'error' | 'success'> = {
  draft: 'default',
  quoted: 'info',
  running: 'info',
  failed: 'error',
  done: 'success',
};

async function load() {
  try {
    items.value = await listProjects();
    error.value = '';
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败';
  } finally {
    loading.value = false;
  }
}

let timer: number | undefined;
let refreshTimer: number | undefined;
const offs: Array<() => void> = [];
onMounted(() => {
  void load();
  timer = window.setInterval(() => {
    if (items.value.some((p) => p.status === 'running')) void load();
  }, 4000);
  const schedule = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => void load(), 500);
  };
  offs.push(onDomain('project', schedule), onDomain('artifact', schedule));
});
onUnmounted(() => {
  window.clearInterval(timer);
  window.clearTimeout(refreshTimer);
  offs.forEach((off) => off());
});
</script>

<template>
  <NCard>
    <template #header>
      <div class="min-w-0">
        <h2 class="m-0 text-base font-semibold text-ink truncate">项目</h2>
        <p class="m-0 mt-1 text-xs text-ink-2">每条片子的文稿、生成状态与发布配置在这里跟踪</p>
      </div>
    </template>
    <template #header-extra>
      <NButton type="primary" @click="router.push('/create')">新建项目</NButton>
    </template>
    <NSpin :show="loading">
      <div v-if="error" class="text-sm text-danger">{{ error }}</div>
      <NEmpty v-else-if="!items.length && !loading" title="还没有项目" description="外部 AI 在工程目录建好项目后，会自动出现在这里。" />
      <div v-else class="flex flex-col gap-2">
        <div
          v-for="p in items"
          :key="p.id"
          class="card px-4 py-3 cursor-pointer transition duration-150 hover:border-brand"
          @click="router.push(`/projects/${encodeURIComponent(p.id)}`)"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <div class="font-semibold text-ink truncate">{{ p.name }}</div>
              <div class="mt-1 text-xs text-ink-3 truncate">
                {{ p.templateName }} · {{ new Date(p.createdAt).toLocaleString() }} · {{ p.duration }}s
              </div>
            </div>
            <NTag :type="statusType[p.status]" size="small" :bordered="false" class="flex-none">
              {{ statusText[p.status] }}
            </NTag>
          </div>
        </div>
      </div>
    </NSpin>
  </NCard>
</template>
