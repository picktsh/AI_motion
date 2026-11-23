<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NSpin, NTabs, NTabPane, NImage, NEmpty } from 'naive-ui';
import { listAllAssets, type GlobalAsset, type AssetMediaType } from '../api/observatory';
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

onMounted(load);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="min-w-0">
      <h2 class="page-title">素材库</h2>
      <p class="page-desc mt-1">盘点工程内全部可用素材与产物，按磁盘文件回显；这里只读，添加素材请交给外部 AI 工具落盘。</p>
    </div>

    <NTabs
      :value="activeTab"
      type="bar"
      class="!w-fit"
      @update:value="(v: string) => (activeTab = v as TabKey)"
    >
      <NTabPane v-for="t in tabs" :key="t.key" :name="t.key">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            {{ t.label }}
            <span class="num text-xs text-ink-3">{{ counts[t.key] }}</span>
          </span>
        </template>
      </NTabPane>
    </NTabs>

    <NSpin :show="loading">
      <NEmpty
        v-if="!filtered.length && !loading"
        title="没有匹配素材"
        :description="assets.length ? '换个分类看看' : '工程目录里还没有素材文件'"
      />

      <div v-if="filtered.length" class="flex flex-col gap-4">
        <!-- 图片 / 视频：网格卡片 -->
        <div v-if="mediaAssets.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div v-for="a in mediaAssets" :key="a.rel" class="card overflow-hidden flex flex-col">
            <div class="h-35 bg-divider grid place-items-center">
              <NImage
                v-if="a.type === 'image'"
                :src="a.url ?? undefined"
                object-fit="cover"
                class="w-full"
                :img-props="{ style: { width: '100%', height: '140px' } }"
                :preview-srcs="imageAssets.map((m) => m.url ?? '')"
              />
              <video v-else :src="a.url ?? ''" controls class="w-full h-full object-cover" />
            </div>
            <div class="p-3 flex flex-col gap-2 flex-1">
              <div class="text-sm text-ink truncate" :title="a.name">{{ a.name }}</div>
              <div class="flex items-center justify-between text-xs text-ink-3">
                <span class="truncate">{{ ownerOf(a) }}</span>
                <span class="num flex-none">{{ formatSize(a.size) }}</span>
              </div>
              <PathCopy :path="a.rel" />
            </div>
          </div>
        </div>

        <!-- 音频：长条波形卡片 -->
        <div v-if="audioAssets.length" class="flex flex-col gap-3">
          <div v-for="a in audioAssets" :key="a.rel" class="card flex items-center gap-3 p-3">
            <div class="flex-1 min-w-0 flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-ink truncate" :title="a.name">{{ a.name }}</span>
                <span class="text-xs text-ink-3 flex-none num">{{ formatSize(a.size) }}</span>
              </div>
              <SamplePlayer :url="a.url" />
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs text-ink-3 truncate">{{ ownerOf(a) }}</span>
                <PathCopy :path="a.rel" class="flex-none max-w-[46%]" />
              </div>
            </div>
          </div>
        </div>

        <!-- 其他文件兜底 -->
        <div v-if="otherAssets.length" class="flex flex-col gap-3">
          <div v-for="a in otherAssets" :key="a.rel" class="card flex items-center gap-3 p-3">
            <span class="text-xs text-ink-3 uppercase flex-none">{{ a.type }}</span>
            <div class="flex-1 min-w-0 flex flex-col gap-1">
              <span class="text-sm text-ink truncate" :title="a.name">{{ a.name }}</span>
              <PathCopy :path="a.rel" />
            </div>
          </div>
        </div>
      </div>
    </NSpin>
  </div>
</template>
