<script setup lang="ts">
import { ref } from 'vue';
import { NIcon } from 'naive-ui';
import { PlayOutline, PauseOutline } from '@vicons/ionicons5';
import InteractiveWave from './InteractiveWave.vue';

const props = defineProps<{
  url: string | null;
  durationS?: number;
}>();

const waveRef = ref<InstanceType<typeof InteractiveWave> | null>(null);
const playing = ref(false);
const current = ref(0);
const duration = ref(props.durationS ?? 0);

function onTime(t: number, d: number) {
  current.value = t;
  if (d > 0) duration.value = d;
}

function onPlay(p: boolean) {
  playing.value = p;
}

async function toggle() {
  await waveRef.value?.toggle();
}

function fmt(t: number): string {
  return `${t.toFixed(1)}s`;
}
</script>

<template>
  <div v-if="url" class="flex items-center gap-2">
    <button type="button" class="flex items-center justify-center w-8 h-8 flex-none border-0 rounded-full bg-brand-soft text-brand cursor-pointer transition-colors duration-150 hover:bg-brand hover:text-white" @click="toggle">
      <n-icon :size="15">
        <component :is="playing ? PauseOutline : PlayOutline" />
      </n-icon>
    </button>
    <InteractiveWave
      ref="waveRef"
      :url="url"
      :height="28"
      class="flex-1 min-w-0"
      @time="onTime"
      @play="onPlay"
    />
    <span class="flex-none text-xs text-ink-2 num">{{ fmt(current) }} / {{ fmt(duration) }}</span>
  </div>
  <div v-else class="text-xs text-ink-3">音频缺失</div>
</template>

