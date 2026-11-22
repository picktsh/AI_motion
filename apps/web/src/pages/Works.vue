<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { listVideos } from '../api/videos';
import SectionCard from '../components/data/SectionCard.vue';
import EmptyState from '../components/data/EmptyState.vue';
import SkeletonBlock from '../components/data/SkeletonBlock.vue';
import PublishPanel from '../components/data/PublishPanel.vue';
import type { VideoSummary } from '../shared/types';

const items = ref<VideoSummary[]>([]);
const activeId = ref<string | null>(null);
const loading = ref(true);

async function load() {
  try {
    items.value = await listVideos();
  } catch {
    items.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function select(id: string) {
  activeId.value = id;
}

const activeItem = computed(() => items.value.find((i) => i.id === activeId.value) ?? null);
</script>

<template>
  <div class="works">
    <aside class="works__list">
      <SectionCard title="作品清单">
        <SkeletonBlock v-if="loading" :rows="4" />
        <EmptyState
          v-else-if="!items.length"
          description="暂无作品"
          tip="作品发布清单会在这里列出；制作工程与素材回显在「视频条目」"
        />
        <ul v-else class="works__items">
          <li
            v-for="v in items"
            :key="v.id"
            class="works__item"
            :class="{ 'works__item--active': v.id === activeId }"
            @click="select(v.id)"
          >
            <div class="works__title">{{ v.title }}</div>
            <div class="works__meta tnum">
              {{ v.duration ?? '—' }}s · {{ v.sceneCount }} 场景 · {{ v.captionCount }} 字幕
            </div>
          </li>
        </ul>
      </SectionCard>
    </aside>

    <section class="works__detail">
      <PublishPanel
        v-if="activeId"
        :key="activeId"
        :entry-id="activeId"
        :fallback-title="activeItem?.title"
      />
      <EmptyState
        v-else
        description="从左侧选择一个作品"
        tip="发布配置、封面与成片交付物在这里维护；制作工程与素材回显在「视频条目」"
      />
    </section>
  </div>
</template>

<style scoped>
.works {
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: 16px;
  align-items: start;
}

.works__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.works__item {
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: background-color 0.15s, border-color 0.15s;
}

.works__item:hover {
  background: var(--color-neutral-soft);
}

.works__item--active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
}

.works__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.works__meta {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

@media (max-width: 960px) {
  .works {
    grid-template-columns: 1fr;
  }
}
</style>
