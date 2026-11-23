<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NButton, NCard, NEmpty, NIcon, NSkeleton, NTag, useMessage } from 'naive-ui';
import { FolderOpenOutline } from '@vicons/ionicons5';
import { listSamples } from '../api/tts';
import { submitJob } from '../api/jobs';
import { useFetch } from '../composables/useFetch';
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
    <NEmpty v-if="error" :description="error">
      <template #icon>
        <NIcon class="text-danger"><FolderOpenOutline /></NIcon>
      </template>
      <template #default>
        <div class="flex flex-col items-center gap-2">
          <p class="m-0 text-xs text-ink-3">音色样例加载失败</p>
          <NButton type="primary" @click="run">重试</NButton>
        </div>
      </template>
    </NEmpty>

    <div v-else-if="loading" class="flex flex-col gap-4">
      <NCard title="音色试音">
        <NSkeleton text :repeat="3" class="w-full" />
      </NCard>
    </div>

    <template v-else-if="data">
      <NCard title="生成音色样例">
        <div class="flex flex-wrap gap-2">
          <NButton size="small" secondary :loading="busyAction === 'tts:samples'" @click="runTtsAction('tts:samples')">生成试音样例</NButton>
        </div>
      </NCard>

      <NCard title="音色试音">
        <div v-if="samples.length" class="grid grid-cols-[repeat(auto-fill,minmax(260px,320px))] gap-4">
          <div v-for="s in samples" :key="s.id" class="flex flex-col gap-2 p-4 border border-border rounded-control">
            <div class="row-between">
              <span class="text-sm font-semibold text-ink">{{ s.label }}</span>
              <NTag type="default" size="small" :bordered="false" class="flex-none w-fit">{{ s.style }}</NTag>
            </div>
            <div class="font-mono text-xs text-ink-3">{{ s.voice }}</div>
            <p class="m-0 text-sm text-ink-2 line-clamp-2 min-h-10">{{ s.text }}</p>
            <div class="flex gap-2 flex-wrap">
              <NTag type="info" size="small" :bordered="false" class="flex-none w-fit">语速 {{ s.rate }}</NTag>
              <NTag type="info" size="small" :bordered="false" class="flex-none w-fit">音调 {{ s.pitch }}</NTag>
            </div>
            <div class="mt-auto">
              <SamplePlayer :url="s.exists ? s.url : null" :duration-s="s.duration_s" />
            </div>
            <div class="text-xs text-ink-3">来源：edge-tts 在线合成 · 本地样例回显</div>
          </div>
        </div>
        <NEmpty v-else description="暂无试音样例" />
      </NCard>
    </template>
  </div>
</template>

