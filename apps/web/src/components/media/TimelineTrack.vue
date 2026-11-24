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
    class="relative w-full overflow-hidden rounded-control bg-divider"
    :style="{ height: `${height}px` }"
    role="timeline"
  >
    <div class="absolute inset-0">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="absolute top-1 bottom-1 border-0 rounded bg-brand-soft cursor-pointer px-1 overflow-hidden text-left"
        :class="item.id === activeId ? 'bg-brand' : ''"
        :style="blockStyle(item)"
        :title="item.label ?? `${item.start.toFixed(2)}–${item.end.toFixed(2)}s`"
        @click="onSeek(item)"
      >
        <span v-if="item.label" class="block text-xs leading-none whitespace-nowrap overflow-hidden text-ellipsis" :class="item.id === activeId ? 'text-white' : 'text-ink-2'">{{ item.label }}</span>
      </button>
    </div>
    <div class="absolute top-0 bottom-0 w-0.5 bg-brand pointer-events-none" :style="{ left: `${playhead}%` }" />
  </div>
</template>

