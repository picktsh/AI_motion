<script setup lang="ts">
import { computed } from 'vue';
import {
  type TimelineItem,
  itemPercent,
  playheadPercent,
} from '../../lib/timeline';

const props = withDefaults(
  defineProps<{
    items: readonly TimelineItem[];
    duration: number;
    activeId?: string | null;
    currentTime?: number;
    height?: number;
  }>(),
  { activeId: null, currentTime: 0, height: 32 },
);

const emit = defineEmits<{ seek: [start: number] }>();

const playhead = computed(() => playheadPercent(props.currentTime, props.duration));

function blockStyle(item: TimelineItem) {
  return itemPercent(item.start, item.end, props.duration);
}

function onSeek(item: TimelineItem) {
  emit('seek', item.start);
}
</script>

<template>
  <div
    class="track"
    :style="{ height: `${height}px` }"
    role="timeline"
    aria-label="时间线轨道"
  >
    <div class="track__items">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="track__item"
        :class="{ 'track__item--active': item.id === activeId }"
        :style="blockStyle(item)"
        :title="item.label ?? `${item.start.toFixed(2)}–${item.end.toFixed(2)}s`"
        @click="onSeek(item)"
      >
        <span v-if="item.label" class="track__label">{{ item.label }}</span>
      </button>
    </div>
    <div class="track__head" :style="{ left: `${playhead}%` }" />
  </div>
</template>

<style scoped>
.track {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 6px;
  background: var(--color-divider, rgba(0, 0, 0, 0.06));
}

.track__items {
  position: absolute;
  inset: 0;
}

.track__item {
  position: absolute;
  top: 4px;
  bottom: 4px;
  border: none;
  border-radius: 4px;
  background: var(--color-brand-soft, rgba(0, 0, 0, 0.12));
  cursor: pointer;
  padding: 0 6px;
  overflow: hidden;
  text-align: left;
}

.track__item--active {
  background: var(--color-brand, #3b82f6);
}

.track__label {
  display: block;
  font-size: 11px;
  line-height: 1;
  color: var(--color-text-secondary, #555);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track__item--active .track__label {
  color: #fff;
}

.track__head {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-brand, #3b82f6);
  pointer-events: none;
}
</style>
