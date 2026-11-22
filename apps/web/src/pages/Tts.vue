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
  <div class="flex flex-col gap-6">
    <EmptyState v-if="error" tone="danger" :description="error" tip="音色样例加载失败">
      <template #action>
        <n-button type="primary" @click="run">重试</n-button>
      </template>
    </EmptyState>

    <div v-else-if="loading" class="flex flex-col gap-4">
      <SectionCard title="音色试音">
        <SkeletonBlock :rows="3" />
      </SectionCard>
    </div>

    <template v-else-if="data">
      <SectionCard title="配音生成">
        <div class="flex flex-wrap gap-2">
          <NButton size="small" :loading="busyAction === 'tts:voice'" @click="runTtsAction('tts:voice')">生成配音分段</NButton>
          <NButton size="small" :loading="busyAction === 'tts:samples'" @click="runTtsAction('tts:samples')">生成试音样例</NButton>
        </div>
      </SectionCard>

      <SectionCard title="音色试音">
        <div v-if="samples.length" class="grid grid-cols-[repeat(auto-fill,minmax(260px,320px))] gap-4">
          <div v-for="s in samples" :key="s.id" class="flex flex-col gap-2 p-4 border border-border rounded-control">
            <div class="row-between">
              <span class="text-sm font-semibold text-ink">{{ s.label }}</span>
              <StatusTag status="neutral" :text="s.style" />
            </div>
            <div class="font-mono text-xs text-ink-3">{{ s.voice }}</div>
            <p class="m-0 text-sm text-ink-2 line-clamp-2 min-h-10">{{ s.text }}</p>
            <div class="flex gap-2 flex-wrap">
              <StatusTag status="info" :text="`语速 ${s.rate}`" />
              <StatusTag status="info" :text="`音调 ${s.pitch}`" />
            </div>
            <div class="mt-auto">
              <SamplePlayer :url="s.exists ? s.url : null" :duration-s="s.duration_s" />
            </div>
            <div class="text-xs text-ink-3">来源：edge-tts 在线合成 · 本地样例回显</div>
          </div>
        </div>
        <EmptyState v-else description="暂无试音样例" />
      </SectionCard>
    </template>
  </div>
</template>

