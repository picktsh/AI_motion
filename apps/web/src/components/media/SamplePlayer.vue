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
  <div v-if="url" class="sample-player">
    <button type="button" class="sample-player__btn" @click="toggle">
      <n-icon :size="15">
        <component :is="playing ? PauseOutline : PlayOutline" />
      </n-icon>
    </button>
    <InteractiveWave
      ref="waveRef"
      :url="url"
      :height="28"
      class="sample-player__wave"
      @time="onTime"
      @play="onPlay"
    />
    <span class="sample-player__time tnum">{{ fmt(current) }} / {{ fmt(duration) }}</span>
  </div>
  <div v-else class="sample-player__missing">音频缺失</div>
</template>

<style scoped>
.sample-player {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sample-player__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex: none;
  border: none;
  border-radius: 50%;
  background: var(--color-brand-soft);
  color: var(--color-brand);
  cursor: pointer;
  transition: background var(--transition);
}

.sample-player__btn:hover {
  background: var(--color-brand);
  color: #fff;
}

.sample-player__wave {
  flex: 1;
  min-width: 0;
}

.sample-player__time {
  flex: none;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.sample-player__missing {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
</style>
