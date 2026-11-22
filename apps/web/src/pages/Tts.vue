<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NButton, useMessage } from 'naive-ui';
import { listSamples } from '../api/tts';
import { submitJob } from '../api/jobs';
import { useFetch } from '../composables/useFetch';
import SectionCard from '../components/data/SectionCard.vue';
import StatusTag from '../components/data/StatusTag.vue';
import SkeletonBlock from '../components/data/SkeletonBlock.vue';
import EmptyState from '../components/data/EmptyState.vue';
import SamplePlayer from '../components/media/SamplePlayer.vue';
import type { Sample, CommandName } from '../shared/types';

const { data, loading, error, run } = useFetch(listSamples);

onMounted(run);

const samples = computed<Sample[]>(() => data.value ?? []);

const message = useMessage();
const busyAction = ref<CommandName | null>(null);

function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const bins = (e as { details?: { missingBins?: string[] } }).details?.missingBins;
  return Array.isArray(bins) && bins.length ? `${msg}：${bins.join('、')}` : msg;
}

async function runTtsAction(command: CommandName): Promise<void> {
  if (busyAction.value) return;
  busyAction.value = command;
  try {
    const job = await submitJob(command, {});
    message.success(`任务已提交：${job.id}`);
  } catch (e) {
    message.error(describeError(e));
  } finally {
    busyAction.value = null;
  }
}
</script>

<template>
  <div class="tts">
    <EmptyState v-if="error" tone="danger" :description="error" tip="音色样例加载失败">
      <template #action>
        <n-button type="primary" @click="run">重试</n-button>
      </template>
    </EmptyState>

    <div v-else-if="loading" class="tts__loading">
      <SectionCard title="音色试音">
        <SkeletonBlock :rows="3" />
      </SectionCard>
    </div>

    <template v-else-if="data">
      <SectionCard title="配音生成">
        <div class="tts__actions">
          <NButton size="small" :loading="busyAction === 'tts:voice'" @click="runTtsAction('tts:voice')">生成配音分段</NButton>
          <NButton size="small" :loading="busyAction === 'tts:samples'" @click="runTtsAction('tts:samples')">生成试音样例</NButton>
        </div>
      </SectionCard>

      <SectionCard title="音色试音">
        <div v-if="samples.length" class="sample-grid">
          <div v-for="s in samples" :key="s.id" class="sample">
            <div class="sample__head">
              <span class="sample__label">{{ s.label }}</span>
              <StatusTag status="neutral" :text="s.style" />
            </div>
            <div class="sample__voice mono">{{ s.voice }}</div>
            <p class="sample__text">{{ s.text }}</p>
            <div class="sample__tags">
              <StatusTag status="info" :text="`语速 ${s.rate}`" />
              <StatusTag status="info" :text="`音调 ${s.pitch}`" />
            </div>
            <div class="sample__player">
              <SamplePlayer :url="s.exists ? s.url : null" :duration-s="s.duration_s" />
            </div>
            <div class="sample__source">来源：edge-tts 在线合成 · 本地样例回显</div>
          </div>
        </div>
        <EmptyState v-else description="暂无试音样例" />
      </SectionCard>
    </template>
  </div>
</template>

<style scoped>
.tts {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.tts__loading {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tts__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sample-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 320px));
  gap: 16px;
}

.sample {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.sample__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sample__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.sample__voice {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.sample__text {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.5em;
}

.sample__tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.sample__player {
  margin-top: auto;
}

.sample__source {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
</style>
