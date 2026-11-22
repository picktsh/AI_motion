<script setup lang="ts">
import { onMounted, ref } from 'vue';
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
  running: 'warning',
  failed: 'error',
  done: 'success',
};

onMounted(async () => {
  try {
    items.value = await listProjects();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <SectionCard title="项目" subtitle="每条片子从模板和文稿开始，生成与发布状态都留在项目里">
    <template #extra>
      <NButton type="primary" @click="router.push('/')">新建项目</NButton>
    </template>
    <NSpin :show="loading">
      <div v-if="error" class="error">{{ error }}</div>
      <EmptyState v-else-if="!items.length && !loading" title="还没有项目" description="从模板挑一个，贴一段文稿，建第一条。" />
      <div v-else class="list">
        <button v-for="p in items" :key="p.id" class="item" @click="router.push(`/projects/${encodeURIComponent(p.id)}`)">
          <div class="main">
            <div class="title">{{ p.name }}</div>
            <div class="meta">{{ p.templateName }} · {{ new Date(p.createdAt).toLocaleString() }} · {{ p.duration }}s</div>
          </div>
          <NTag :type="statusType[p.status]" size="small" :bordered="false">{{ statusText[p.status] }}</NTag>
        </button>
      </div>
    </NSpin>
  </SectionCard>
</template>

<style scoped>
.list { display: flex; flex-direction: column; gap: 10px; }
.item { display: flex; align-items: center; justify-content: space-between; gap: 16px; text-align: left; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-bg-elevated); cursor: pointer; }
.item:hover { border-color: var(--color-primary); }
.title { font-weight: 600; color: var(--color-text-primary); }
.meta { margin-top: 4px; font-size: 12px; color: var(--color-text-tertiary); }
.error { color: var(--color-danger); font-size: 13px; }
</style>
