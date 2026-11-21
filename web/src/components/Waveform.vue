<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { getSharedContext } from '../composables/audioContext';

const props = withDefaults(
  defineProps<{
    url: string | null;
    height?: number;
    bars?: number;
  }>(),
  { height: 40, bars: 72 },
);

const container = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const peaks = ref<number[]>([]);
const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');

let token = 0;
let ro: ResizeObserver | null = null;

function bucketPeaks(data: Float32Array, bars: number): number[] {
  const out: number[] = [];
  const size = Math.floor(data.length / bars) || 1;
  for (let i = 0; i < bars; i++) {
    const start = i * size;
    let max = 0;
    for (let j = start; j < Math.min(start + size, data.length); j++) {
      const v = Math.abs(data[j]);
      if (v > max) max = v;
    }
    out.push(max);
  }
  const peak = Math.max(...out, 0.05);
  return out.map((v) => v / peak);
}

function draw() {
  const el = canvas.value;
  const box = container.value;
  if (!el || !box) return;
  const dpr = window.devicePixelRatio || 1;
  const w = box.clientWidth;
  const h = props.height;
  el.width = Math.max(1, Math.round(w * dpr));
  el.height = Math.max(1, Math.round(h * dpr));
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const css = getComputedStyle(document.documentElement);
  const barColor = css.getPropertyValue('--color-brand').trim();
  const railColor = css.getPropertyValue('--color-divider').trim();

  const n = props.bars;
  const gap = 2;
  const barW = Math.max(2, (w - gap * (n - 1)) / n);
  const usable = h - 8;
  const mid = h / 2;

  for (let i = 0; i < n; i++) {
    const x = i * (barW + gap);
    const v = state.value === 'ready' ? peaks.value[i] ?? 0 : 0.08;
    const barH = Math.max(2, v * usable);
    ctx.fillStyle = state.value === 'ready' ? barColor : railColor;
    ctx.beginPath();
    ctx.roundRect(x, mid - barH / 2, barW, barH, Math.min(2, barW / 2));
    ctx.fill();
  }
}

async function load() {
  const seq = ++token;
  peaks.value = [];
  if (!props.url) {
    state.value = 'idle';
    draw();
    return;
  }
  state.value = 'loading';
  draw();
  try {
    const res = await fetch(props.url);
    if (!res.ok) throw new Error('media not found');
    const buf = await res.arrayBuffer();
    const audio = await getSharedContext().decodeAudioData(buf);
    if (seq !== token) return;
    peaks.value = bucketPeaks(audio.getChannelData(0), props.bars);
    state.value = 'ready';
  } catch {
    if (seq !== token) return;
    state.value = 'error';
  }
  draw();
}

onMounted(async () => {
  await nextTick();
  ro = new ResizeObserver(() => draw());
  if (container.value) ro.observe(container.value);
  void load();
});

watch(() => props.url, () => void load());

onBeforeUnmount(() => {
  token += 1;
  ro?.disconnect();
});
</script>

<template>
  <div ref="container" class="waveform" :style="{ height: `${height}px` }">
    <canvas ref="canvas" class="waveform__canvas" />
    <div v-if="state === 'loading'" class="waveform__hint">解码中…</div>
    <div v-if="state === 'error'" class="waveform__hint">波形不可用</div>
  </div>
</template>

<style scoped>
.waveform {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
}

.waveform__canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.waveform__hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-text-tertiary);
  pointer-events: none;
}
</style>
