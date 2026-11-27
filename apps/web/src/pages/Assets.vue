<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { NButton, NSpin, NImage, NEmpty } from 'naive-ui';
import { listAllAssets, type GlobalAsset, type AssetMediaType } from '../api/observatory';
import { onDomain } from '../api/events';
import PathCopy from '../components/data/PathCopy.vue';
import SamplePlayer from '../components/media/SamplePlayer.vue';

type TabKey = 'all' | AssetMediaType;

const loading = ref(true);
const assets = ref<GlobalAsset[]>([]);
const activeTab = ref<TabKey>('all');

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
];

const counts = computed<Record<TabKey, number>>(() => {
  const c: Record<TabKey, number> = { all: assets.value.length, image: 0, video: 0, audio: 0, file: 0 };
  for (const a of assets.value) c[a.type] += 1;
  return c;
});

const filtered = computed(() =>
  assets.value.filter((a) => activeTab.value === 'all' || a.type === activeTab.value),
);

const imageAssets = computed(() => filtered.value.filter((a) => a.type === 'image'));
const mediaAssets = computed(() => filtered.value.filter((a) => a.type === 'image' || a.type === 'video'));
const audioAssets = computed(() => filtered.value.filter((a) => a.type === 'audio'));
const otherAssets = computed(() => filtered.value.filter((a) => a.type === 'file'));

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function ownerOf(a: GlobalAsset): string {
  return a.source === 'project' ? a.projectName ?? '项目素材' : '配音样例';
}

async function load() {
  loading.value = true;
  try {
    assets.value = await listAllAssets();
  } finally {
    loading.value = false;
  }
}

let refreshTimer: number | undefined;
const offs: Array<() => void> = [];

onMounted(() => {
  void load();
  offs.push(
    onDomain('asset', () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void load(), 500);
    }),
  );
});
onUnmounted(() => {
  window.clearTimeout(refreshTimer);
  offs.forEach((off) => off());
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="text-sm text-ink-2">共 {{ filtered.length }} 个文件 · 面板上传与外部 AI 落盘均会从磁盘统一回显</div>
      <div class="flex items-center gap-1.5 p-1 rounded-full bg-glass-soft border border-glass-border">
        <NButton
          v-for="t in tabs"
          :key="t.key"
          :secondary="activeTab !== t.key"
          :type="activeTab === t.key ? 'primary' : 'default'"
          class="!px-3 !h-8"
          @click="activeTab = t.key"
        >
          {{ t.label }} <span class="ml-1 opacity-70 num">{{ counts[t.key] }}</span>
        </NButton>
      </div>
    </div>

    <NSpin :show="loading">
      <NEmpty
        v-if="!filtered.length && !loading"
        title="没有匹配素材"
        :description="assets.length ? '换个分类看看' : '工程目录里还没有素材文件'"
      />

      <div v-if="filtered.length" class="flex flex-col gap-6">
        <section v-if="mediaAssets.length" class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <h2 class="m-0 text-sm font-semibold text-ink">图片与视频</h2>
            <span class="text-xs text-ink-3 num">{{ mediaAssets.length }}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <article v-for="a in mediaAssets" :key="a.rel" class="glass-panel overflow-hidden flex flex-col">
              <div class="relative aspect-video bg-glass-soft overflow-hidden">
              <NImage
                v-if="a.type === 'image'"
                :src="a.url ?? undefined"
                object-fit="cover"
                class="w-full h-full"
                :img-props="{ style: { width: '100%', height: '100%', objectFit: 'cover' } }"
                :preview-srcs="imageAssets.map((m) => m.url ?? '')"
              />
              <video v-else :src="a.url ?? ''" controls preload="metadata" class="w-full h-full object-contain bg-black" />
                <span class="absolute left-3 top-3 px-2.5 py-1 rounded-full bg-black/55 text-white text-[10px] backdrop-blur-sm">
                  {{ a.type === 'image' ? '图片' : '视频' }}
                </span>
              </div>
              <div class="flex flex-col gap-2 p-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-ink truncate" :title="a.name">{{ a.name }}</div>
                    <div class="mt-1 text-xs text-ink-3 truncate">{{ ownerOf(a) }} · {{ formatSize(a.size) }}</div>
                  </div>
                </div>
                <PathCopy :path="a.rel" />
              </div>
            </article>
          </div>
        </section>

        <section v-if="audioAssets.length" class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <h2 class="m-0 text-sm font-semibold text-ink">音频</h2>
            <span class="text-xs text-ink-3 num">{{ audioAssets.length }}</span>
          </div>
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <article v-for="a in audioAssets" :key="a.rel" class="glass-surface rounded-[20px] p-4 flex flex-col gap-3">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-ink truncate" :title="a.name">{{ a.name }}</div>
                  <div class="mt-1 text-xs text-ink-3 truncate">{{ ownerOf(a) }} · {{ formatSize(a.size) }}</div>
                </div>
                <span class="flex-none w-9 h-9 grid place-items-center rounded-full bg-brand-soft text-brand text-xs font-bold">A</span>
              </div>
              <SamplePlayer :url="a.url" />
              <PathCopy :path="a.rel" />
            </article>
          </div>
        </section>

        <section v-if="otherAssets.length" class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <h2 class="m-0 text-sm font-semibold text-ink">其他文件</h2>
            <span class="text-xs text-ink-3 num">{{ otherAssets.length }}</span>
          </div>
          <article v-for="a in otherAssets" :key="a.rel" class="glass-surface flex items-center gap-3 p-3 rounded-2xl">
            <span class="flex-none px-2.5 py-1 rounded-full bg-neutral-soft text-xs text-ink-2 uppercase">{{ a.type }}</span>
            <div class="flex-1 min-w-0 flex flex-col gap-1">
              <span class="text-sm text-ink truncate" :title="a.name">{{ a.name }}</span>
              <span class="text-xs text-ink-3">{{ ownerOf(a) }} · {{ formatSize(a.size) }}</span>
              <PathCopy :path="a.rel" />
            </div>
          </article>
        </section>
      </div>
    </NSpin>
  </div>
</template>
