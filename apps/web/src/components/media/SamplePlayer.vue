<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { NButton, NIcon } from 'naive-ui';
import { PlayOutline, PauseOutline } from '@vicons/ionicons5';
import InteractiveWave from './InteractiveWave.vue';
import { claimExclusive, releaseExclusive } from '../../composables/useExclusivePlayer';

const props = defineProps<{
  url: string | null;
  durationS?: number;
}>();

const waveRef = ref<InstanceType<typeof InteractiveWave> | null>(null);
const playing = ref(false);
const current = ref(0);
const duration = ref(props.durationS ?? 0);

const pauseSelf: () => void = () => waveRef.value?.pause();

function onTime(t: number, d: number) {
  current.value = t;
  if (d > 0) duration.value = d;
}

function onPlay(p: boolean) {
  playing.value = p;
  if (p) claimExclusive(pauseSelf);
  else releaseExclusive(pauseSelf);
}

async function toggle() {
  await waveRef.value?.toggle();
}

onBeforeUnmount(() => releaseExclusive(pauseSelf));

function fmt(t: number): string {
  return `${t.toFixed(1)}s`;
}
</script>

<template>
  <div v-if="url" class="flex items-center gap-2">
    <NButton circle secondary class="flex-none text-brand" @click="toggle">
      <NIcon :size="15">
        <component :is="playing ? PauseOutline : PlayOutline" />
      </NIcon>
    </NButton>
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

