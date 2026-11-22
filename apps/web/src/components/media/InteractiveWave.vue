<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import WaveSurfer from 'wavesurfer.js';

const props = withDefaults(
  defineProps<{
    url: string | null;
    height?: number;
    barWidth?: number;
  }>(),
  { height: 40, barWidth: 2 },
);

const emit = defineEmits<{
  time: [current: number, duration: number];
  play: [playing: boolean];
}>();

const container = ref<HTMLElement | null>(null);
const playing = ref(false);
const current = ref(0);
const duration = ref(0);

let ws: WaveSurfer | null = null;

function readColors() {
  const css = getComputedStyle(document.documentElement);
  const wave = css.getPropertyValue('--color-divider').trim() || 'rgba(128,128,128,0.28)';
  const progress = css.getPropertyValue('--color-brand').trim() || '#3b82f6';
  return { wave, progress, cursor: progress };
}

function createPlayer() {
  if (!container.value) return;
  const c = readColors();
  const host = container.value.firstElementChild as HTMLElement | null;
  if (host) {
    host.style.width = '100%';
    host.style.height = '100%';
  }
  ws = WaveSurfer.create({
    container: container.value,
    url: props.url ?? undefined,
    height: props.height,
    barWidth: props.barWidth,
    barGap: 2,
    barRadius: 2,
    waveColor: c.wave,
    progressColor: c.progress,
    cursorColor: c.cursor,
    cursorWidth: 1,
    interact: true,
    dragToSeek: true,
    normalize: true,
  });
  ws.on('ready', (d) => {
    duration.value = d;
    emit('time', current.value, d);
  });
  ws.on('timeupdate', (t) => {
    current.value = t;
    emit('time', t, duration.value);
  });
  ws.on('play', () => {
    playing.value = true;
    emit('play', true);
  });
  ws.on('pause', () => {
    playing.value = false;
    emit('play', false);
  });
  ws.on('finish', () => {
    playing.value = false;
    current.value = 0;
    emit('play', false);
  });
  ws.on('error', () => {
    /* 波形不可用时静默降级，保留容器空位 */
  });
}

async function reload() {
  if (!ws) return;
  if (!props.url) return;
  try {
    await ws.load(props.url);
  } catch {
    /* 加载失败由 error 事件兜底 */
  }
}

function toggle(): void {
  void ws?.playPause();
}

defineExpose({ toggle, playing, current, duration });

onMounted(async () => {
  await nextTick();
  createPlayer();
});

watch(() => props.url, () => void reload());

onBeforeUnmount(() => {
  ws?.destroy();
  ws = null;
});
</script>

<template>
  <div ref="container" class="interactive-wave" :style="{ height: `${height}px` }" />
</template>

<style scoped>
.interactive-wave {
  width: 100%;
  min-width: 0;
  display: block;
}

/* wavesurfer 宿主 div 默认按内容收缩，在 flex/块布局里会塌到 min-width:1px，
   这里强制填满外层容器，避免 scroll 宽度 1px、canvas 不绘制 */
.interactive-wave :deep(> div) {
  width: 100%;
  height: 100%;
}

.interactive-wave :deep(canvas) {
  cursor: pointer;
}
</style>
