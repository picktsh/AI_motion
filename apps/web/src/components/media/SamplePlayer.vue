<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { NIcon } from 'naive-ui';
import { PlayOutline, PauseOutline } from '@vicons/ionicons5';
import Waveform from './Waveform.vue';

const props = defineProps<{
  url: string | null;
  durationS?: number;
}>();

const audio = ref<HTMLAudioElement | null>(null);
const playing = ref(false);
const current = ref(0);
const duration = ref(props.durationS ?? 0);

function onMeta() {
  if (audio.value?.duration) duration.value = audio.value.duration;
}

function onTime() {
  if (!audio.value) return;
  current.value = audio.value.currentTime;
}

function onEnd() {
  playing.value = false;
  current.value = 0;
}

async function toggle() {
  if (!audio.value || !props.url) return;
  if (playing.value) {
    audio.value.pause();
  } else {
    try {
      await audio.value.play();
      playing.value = true;
    } catch {
      playing.value = false;
    }
  }
}

function fmt(t: number): string {
  return `${t.toFixed(1)}s`;
}

onBeforeUnmount(() => {
  audio.value?.pause();
});
</script>

<template>
  <div v-if="url" class="sample-player">
    <button type="button" class="sample-player__btn" @click="toggle">
      <n-icon :size="15">
        <component :is="playing ? PauseOutline : PlayOutline" />
      </n-icon>
    </button>
    <Waveform :url="url" :height="28" class="sample-player__wave" />
    <span class="sample-player__time tnum">{{ fmt(current) }} / {{ fmt(duration) }}</span>
    <audio
      ref="audio"
      preload="none"
      @timeupdate="onTime"
      @ended="onEnd"
      @loadedmetadata="onMeta"
      @pause="playing = false"
    >
      <source :src="url" />
    </audio>
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
