<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NTag, NSpin } from 'naive-ui';
import { listProjects, type Project } from '../api/projects';
import SectionCard from '../components/data/SectionCard.vue';
import EmptyState from '../components/data/EmptyState.vue';

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
onMounted(() => {
  void load();
  timer = window.setInterval(() => {
    if (items.value.some((p) => p.status === 'running')) void load();
  }, 4000);
});
onUnmounted(() => window.clearInterval(timer));
</script>

<template>
  <SectionCard title="项目" subtitle="每条片子从模板和文稿开始，生成进度在这里跟踪">
    <template #extra>
      <NButton type="primary" @click="router.push('/')">新建项目</NButton>
    </template>
    <NSpin :show="loading">
      <div v-if="error" class="text-sm text-danger">{{ error }}</div>
      <EmptyState v-else-if="!items.length && !loading" title="还没有项目" description="从模板挑一个，贴一段文稿，建第一条。" />
      <div v-else class="flex flex-col gap-2">
        <button
          v-for="p in items"
          :key="p.id"
          class="flex items-center justify-between gap-4 text-left px-4 py-3 border border-border rounded-control bg-overlay cursor-pointer transition-colors duration-150 hover:border-brand"
          @click="router.push(`/projects/${encodeURIComponent(p.id)}`)"
        >
          <div class="min-w-0">
            <div class="font-semibold text-ink truncate">{{ p.name }}</div>
            <div class="mt-1 text-xs text-ink-3 truncate">
              {{ p.templateName }} · {{ new Date(p.createdAt).toLocaleString() }} · {{ p.duration }}s
            </div>
          </div>
          <NTag :type="statusType[p.status]" size="small" :bordered="false" class="flex-none">
            {{ statusText[p.status] }}
          </NTag>
        </button>
      </div>
    </NSpin>
  </SectionCard>
</template>
