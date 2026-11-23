<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NSelect, NImage, NIcon, NTooltip, NButton, NCard, NEmpty, NSkeleton, NTag, NInputNumber, useMessage } from 'naive-ui';
import { FilmOutline, DocumentOutline, FolderOpenOutline } from '@vicons/ionicons5';
import { listVideos, getVideoDetail } from '../api/videos';
import { listSegments } from '../api/tts';
import { submitJob } from '../api/jobs';
import { useFetch } from '../composables/useFetch';
import PathCopy from '../components/data/PathCopy.vue';
import SamplePlayer from '../components/media/SamplePlayer.vue';
import TimelineTrack from '../components/media/TimelineTrack.vue';
import type { VideoSummary, VideoDetail, Artifact, ProbeResult, Segment, CommandName } from '../shared/types';
import { activeItemIndex, type TimelineItem } from '../lib/timeline';

/* 列表 */
const { data, loading, error, run } = useFetch(listVideos);

onMounted(run);

const query = ref('');
const sortBy = ref<'default' | 'duration' | 'captions'>('default');
const sortOptions = [
  { label: '默认排序', value: 'default' },
  { label: '时长优先', value: 'duration' },
  { label: '字幕数优先', value: 'captions' },
];

const filtered = computed<VideoSummary[]>(() => {
  const arr = (data.value ?? []).filter(
    (v) => !query.value || v.title.toLowerCase().includes(query.value.toLowerCase()),
  );
  if (sortBy.value === 'duration') return [...arr].sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));
  if (sortBy.value === 'captions') return [...arr].sort((a, b) => b.captionCount - a.captionCount);
  return arr;
});

/* 详情 */
const activeId = ref<string | null>(null);
const detail = ref<VideoDetail | null>(null);
const detailLoading = ref(false);
const detailError = ref('');
const mainVideoEl = ref<HTMLVideoElement | null>(null);
const mainTime = ref(0);
const mainDuration = ref(0);
const reqSeq = ref(0);

function onVideoTime() {
  if (mainVideoEl.value) mainTime.value = mainVideoEl.value.currentTime;
}
function onVideoMeta() {
  if (mainVideoEl.value?.duration) mainDuration.value = mainVideoEl.value.duration;
}
function seekTo(t: number) {
  if (mainVideoEl.value) mainVideoEl.value.currentTime = t;
}

async function loadDetail(id: string) {
  const seq = ++reqSeq.value;
  detailLoading.value = true;
  detailError.value = '';
  detail.value = null;
  mainTime.value = 0;
  mainDuration.value = 0;
  try {
    const d = await getVideoDetail(id);
    if (seq !== reqSeq.value) return;
    detail.value = d;
    selectedInstance.value = 'instance';
  } catch (e) {
    if (seq !== reqSeq.value) return;
    detailError.value = e instanceof Error ? e.message : String(e);
  } finally {
    if (seq === reqSeq.value) detailLoading.value = false;
  }
}

function select(id: string) {
  if (activeId.value === id) return;
  activeId.value = id;
  void loadDetail(id);
}

/* 命令动作：参数由当前条目上下文自动带入，命令台只负责队列与日志 */
const message = useMessage();
const busyAction = ref<CommandName | null>(null);
const selectedInstance = ref('instance');
const previewTime = ref(1);

const instanceOptions = computed(() => {
  const dirs = detail.value?.instanceDirs ?? [];
  return [...new Set(['instance', ...dirs])].map((d) => ({ label: d, value: d }));
});

function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const bins = (e as { details?: { missingBins?: string[] } }).details?.missingBins;
  return Array.isArray(bins) && bins.length ? `${msg}：${bins.join('、')}` : msg;
}

async function runAction(command: CommandName): Promise<void> {
  if (!detail.value || busyAction.value) return;
  busyAction.value = command;
  try {
    const params: Record<string, unknown> = { entryId: detail.value.id };
    if (command !== 'plan') params.instanceName = selectedInstance.value;
    if (command === 'preview') params.time = previewTime.value;
    const job = await submitJob(command, params);
    message.success(`任务已提交：${job.id}`);
  } catch (e) {
    message.error(describeError(e));
  } finally {
    busyAction.value = null;
  }
}

/* 配音分段与词边界：全局一份回显，仅归属到时长匹配的当前视频 */
const segments = ref<Segment[]>([]);

async function loadSegments() {
  try {
    segments.value = await listSegments();
  } catch {
    segments.value = [];
  }
}

onMounted(loadSegments);

const captions = computed(() => detail.value?.meta.captions ?? []);

/* 当前命中字幕：随主片播放头联动；-1 表示无命中。 */
const activeCaption = computed(() =>
  activeItemIndex(
    captions.value.map((c, i) => ({ id: String(i), start: c.start, end: c.end })),
    mainTime.value,
  ),
);

const captionItems = computed<TimelineItem[]>(() =>
  captions.value.map((c, i) => ({
    id: String(i),
    start: Number(c.start) || 0,
    end: Number(c.end) || 0,
    label: String(c.text ?? ''),
  })),
);

const trackDuration = computed(() => mainDuration.value || detail.value?.meta.duration || 0);

const totalSegEnd = computed(() =>
  Math.max(1, ...segments.value.map((s) => s.windowEnd)),
);

const matchedSegments = computed<Segment[]>(() => {
  if (!detail.value || !captions.value.length) return [];
  const dur = detail.value.meta.duration;
  if (dur == null) return [];
  if (Math.abs(totalSegEnd.value - dur) > 1.5) return [];
  return segments.value;
});

const expandedSegId = ref<string | null>(null);
function toggleSegment(id: string) {
  expandedSegId.value = expandedSegId.value === id ? null : id;
}

function spanStyle(s: Segment) {
  const left = (s.windowStart / totalSegEnd.value) * 100;
  const width = ((s.windowEnd - s.windowStart) / totalSegEnd.value) * 100;
  return { left: `${left}%`, width: `${width}%` };
}

/* 背景音乐：从 media 配置的 music 项单列，license 取自输入物料清单 */
const bgm = computed(() => detail.value?.mediaRefs.find((m) => m.role === 'music') ?? null);
const bgmLicense = computed(() => {
  const media = (detail.value?.meta.media ?? {}) as Record<string, { license?: string }>;
  return media.music?.license ?? null;
});

const mainVideo = computed<Artifact | null>(
  () => detail.value?.artifacts.find((a) => a.type === 'video') ?? null,
);

interface MediaView {
  role: string;
  file: string;
  type: string;
  exists: boolean;
  url: string | null;
}

const mediaViews = computed<MediaView[]>(() => {
  if (!detail.value) return [];
  const seen = new Set<string>();
  const merged: MediaView[] = [];
  for (const m of detail.value.mediaRefs) {
    if (m.role === 'music') continue;
    if (seen.has(m.file)) continue;
    seen.add(m.file);
    merged.push({ role: m.role, file: m.file, type: m.type, exists: m.exists, url: m.url });
  }
  for (const e of detail.value.extraAssets) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    merged.push({ role: e.name, file: e.name, type: e.type, exists: !!e.url, url: e.url });
  }
  return merged;
});

/* probe 格式化 */
function fmtSize(n?: number | null): string {
  if (!n) return '—';
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function fmtStreams(probe?: ProbeResult | null): string {
  if (!probe?.ok || !probe.streams?.length) return '未探测';
  return probe.streams
    .map((s) => {
      if (s.type === 'video') return `${s.codec} ${s.width ?? '?'}×${s.height ?? '?'}`;
      if (s.type === 'audio')
        return `${s.codec}${s.channels ? ` · ${s.channels}ch` : ''}${s.sampleRate ? ` · ${s.sampleRate}Hz` : ''}`;
      return s.codec || s.type;
    })
    .filter(Boolean)
    .join(' · ');
}

function probeMeta(a: Artifact): string {
  if (!a.probe?.ok) return '未探测';
  const parts: string[] = [];
  if (a.probe.duration != null) parts.push(`${a.probe.duration.toFixed(1)}s`);
  if (a.probe.size) parts.push(fmtSize(a.probe.size));
  const streams = fmtStreams(a.probe);
  if (streams !== '未探测') parts.push(streams);
  return parts.join(' · ') || '未探测';
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
      <!-- 左侧列表 -->
      <aside class="flex flex-col gap-3">
        <NInput
          v-model:value="query"
          placeholder="按标题过滤"
          clearable
          size="small"
        />
        <NSelect
          v-model:value="sortBy"
          :options="sortOptions"
          size="small"
        />

        <NEmpty v-if="error" :description="error">
          <template #icon>
            <NIcon class="text-danger"><FolderOpenOutline /></NIcon>
          </template>
          <template #default>
            <div class="flex flex-col items-center gap-2">
              <NButton type="primary" size="small" @click="run">重试</NButton>
            </div>
          </template>
        </NEmpty>

        <div v-else-if="loading" class="flex flex-col gap-2">
          <div v-for="i in 4" :key="i" class="flex gap-3 p-3 bg-panel border border-border rounded-control">
            <NSkeleton text :repeat="2" class="w-full" />
          </div>
        </div>

        <div v-else-if="filtered.length" class="flex flex-col gap-2">
        <div
          v-for="v in filtered"
          :key="v.id"
          class="px-3 py-3 rounded-control cursor-pointer transition duration-150"
          :class="v.id === activeId ? 'border border-brand bg-brand-soft' : 'border border-transparent hover:border-border'"
          @click="select(v.id)"
        >
          <div class="flex gap-3">
            <div class="w-24 h-14 flex-none rounded-control bg-divider flex items-center justify-center overflow-hidden">
              <img v-if="v.preview?.url" :src="v.preview.url" :alt="v.title" class="w-full h-full object-cover" />
              <NIcon v-else :size="20" class="text-ink-3">
                <FilmOutline />
              </NIcon>
            </div>
            <div class="min-w-0 flex flex-col gap-1">
              <div class="text-sm font-medium text-ink line-clamp-2">{{ v.title }}</div>
              <div class="text-xs text-ink-2 num">
                {{ v.duration ?? '—' }}s · {{ v.sceneCount }} 场景 · {{ v.captionCount }} 字幕
              </div>
            </div>
          </div>
        </div>
        </div>

        <NEmpty v-else description="暂无视频条目" />
      </aside>

      <!-- 右侧详情 -->
      <section class="min-w-0">
        <NEmpty v-if="!activeId" class="card min-h-80 px-5 py-10 flex flex-col items-center justify-center" description="从左侧选择一个视频条目查看详情" />

        <div v-else-if="detailLoading" class="p-4">
          <NSkeleton text :repeat="6" class="w-full" />
        </div>

        <NEmpty v-else-if="detailError" :description="detailError">
          <template #icon>
            <NIcon class="text-danger"><FolderOpenOutline /></NIcon>
          </template>
          <template #default>
            <div class="flex flex-col items-center gap-2">
              <NButton type="primary" size="small" @click="activeId && loadDetail(activeId)">重试</NButton>
            </div>
          </template>
        </NEmpty>

        <div v-else-if="detail" class="flex flex-col gap-4 min-w-0">
          <!-- 播放器 -->
          <NCard>
            <div class="flex items-center justify-center bg-divider rounded-control aspect-video overflow-hidden">
              <video
                v-if="mainVideo"
                ref="mainVideoEl"
                :src="mainVideo.url"
                controls
                class="w-full h-full object-contain"
                @timeupdate="onVideoTime"
                @loadedmetadata="onVideoMeta"
              />
              <div v-else class="flex flex-col items-center gap-2 text-ink-3 text-sm">
                <NIcon :size="28" class="text-ink-3">
                  <FilmOutline />
                </NIcon>
                <span>暂无成片</span>
              </div>
            </div>
          </NCard>

          <!-- 生成操作：命令按当前条目上下文触发，路径自动带入 -->
          <NCard title="生成操作">
            <div class="flex flex-wrap items-end gap-4">
              <div class="flex flex-wrap gap-3">
                <div class="flex flex-col gap-1 min-w-40">
                  <label class="text-xs text-ink-3">实例目录</label>
                  <NSelect v-model:value="selectedInstance" :options="instanceOptions" size="small" />
                </div>
                <div class="flex flex-col gap-1 min-w-40">
                  <label class="text-xs text-ink-3">预览时刻（秒）</label>
                  <NInputNumber v-model:value="previewTime" :min="0.1" :step="0.5" size="small" />
                </div>
              </div>
              <div class="ml-auto flex flex-wrap gap-2">
                <NButton size="small" secondary :loading="busyAction === 'plan'" @click="runAction('plan')">计划校验</NButton>
                <NButton size="small" secondary :loading="busyAction === 'prepare'" @click="runAction('prepare')">准备实例</NButton>
                <NButton size="small" secondary :loading="busyAction === 'preview'" @click="runAction('preview')">预览单帧</NButton>
                <NButton type="primary" size="small" :loading="busyAction === 'render'" @click="runAction('render')">渲染成片</NButton>
              </div>
            </div>
          </NCard>

          <!-- 元信息 -->
          <NCard title="工程信息">
            <div class="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              <div class="flex items-center gap-2 text-sm py-1">
                <span class="flex-none text-xs text-ink-3 w-16">布局</span>
                <span class="text-ink">{{ detail!.meta.layout || '—' }}</span>
              </div>
              <div class="flex items-center gap-2 text-sm py-1">
                <span class="flex-none text-xs text-ink-3 w-16">时长</span>
                <span class="text-ink num">{{ detail!.meta.duration ?? '—' }}s</span>
              </div>
              <div class="flex items-center gap-2 text-sm py-1">
                <span class="flex-none text-xs text-ink-3 w-16">场景</span>
                <span class="text-ink num">{{ detail!.meta.scenes?.length ?? 0 }}</span>
              </div>
              <div class="flex items-center gap-2 text-sm py-1">
                <span class="flex-none text-xs text-ink-3 w-16">字幕</span>
                <span class="text-ink num">{{ captions.length }}</span>
              </div>
            </div>
            <div class="flex flex-col items-start gap-1 text-sm py-1">
              <span class="flex-none text-xs text-ink-3 w-16">输入文件</span>
              <PathCopy :path="detail!.inputFile" />
            </div>
            <div v-if="detail!.instanceDirs?.length" class="flex flex-col items-start gap-1 text-sm py-1">
              <span class="flex-none text-xs text-ink-3 w-16">实例目录</span>
              <div class="flex flex-wrap gap-2">
                <NTag v-for="d in detail!.instanceDirs" :key="d" type="default" size="small" :bordered="false" class="flex-none w-fit">{{ d }}</NTag>
              </div>
            </div>
          </NCard>

          <!-- 背景音乐 -->
          <NCard v-if="bgm" title="背景音乐">
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-2 flex-wrap">
                <NTag type="default" size="small" :bordered="false" class="flex-none w-fit">{{ bgm.file }}</NTag>
                <span v-if="bgmLicense" class="flex-1 min-w-0 text-xs text-ink-3 truncate">{{ bgmLicense }}</span>
              </div>
              <SamplePlayer :url="bgm.url" />
            </div>
          </NCard>

          <!-- 引用素材 -->
          <NCard title="引用素材">
            <div v-if="mediaViews.length" class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              <div v-for="m in mediaViews" :key="m.file" class="flex flex-col gap-2 p-3 border border-border rounded-control">
                <div class="row-between">
                  <NTag :type="m.exists ? 'default' : 'error'" size="small" :bordered="false" class="flex-none w-fit">{{ m.role }}</NTag>
                  <span class="text-xs text-ink-2 truncate font-mono">{{ m.file }}</span>
                </div>
                <div class="flex-1 flex items-center justify-center min-h-20">
                  <NImage
                    v-if="m.type === 'image' && m.url"
                    :src="m.url"
                    :width="120"
                    object-fit="contain"
                  />
                  <div v-else-if="m.type === 'audio' && m.url" class="flex flex-col gap-2 w-full">
                    <SamplePlayer :url="m.url" />
                  </div>
                  <audio v-else-if="m.url" controls class="w-full">
                    <source :src="m.url" />
                  </audio>
                  <div v-else class="flex flex-col items-center gap-1 text-ink-3 text-xs">
                    <NTag type="error" size="small" :bordered="false" class="flex-none w-fit">缺失</NTag>
                    <span class="mono">{{ m.file }}</span>
                  </div>
                </div>
              </div>
            </div>
            <NEmpty v-else description="无引用素材" />
          </NCard>

          <!-- 字幕 -->
          <NCard :title="`字幕（${captions.length}）`">
            <TimelineTrack
              v-if="captions.length"
              class="mb-3"
              :items="captionItems"
              :duration="trackDuration"
              :active-id="activeCaption >= 0 ? String(activeCaption) : null"
              :current-time="mainTime"
              :height="36"
              @seek="seekTo"
            />
            <div v-if="captions.length" class="flex flex-col">
              <div class="grid grid-cols-[80px_80px_1fr] gap-3 px-2 py-2 text-xs text-ink-3">
                <span>开始</span>
                <span>结束</span>
                <span>文本</span>
              </div>
              <div
                v-for="(c, i) in captions"
                :key="i"
                class="px-2 py-2 rounded-control cursor-pointer transition duration-150"
                :class="activeCaption === i ? 'bg-brand-soft' : 'hover:bg-neutral-soft'"
                @click="seekTo(c.start)"
              >
                <div class="grid grid-cols-[80px_80px_1fr] gap-3 text-sm text-ink">
                  <span class="text-ink-2 text-xs num">{{ c.start.toFixed(2) }}</span>
                  <span class="text-ink-2 text-xs num">{{ c.end.toFixed(2) }}</span>
                  <span class="truncate">{{ c.text }}</span>
                </div>
              </div>
            </div>
            <NEmpty v-else description="暂无字幕" />
          </NCard>

          <!-- 配音分段与词边界 -->
          <NCard
            v-if="matchedSegments.length"
            :title="`配音分段与词边界（${matchedSegments.length}）`"
          >
            <div class="flex flex-col gap-4">
              <div class="relative h-9 rounded-control bg-divider overflow-hidden">
                <div
                  v-for="s in matchedSegments"
                  :key="s.id"
                  class="absolute top-1 bottom-1 flex items-center px-2 rounded-control bg-brand-soft text-brand cursor-pointer text-xs transition-colors duration-150"
                  :class="expandedSegId === s.id ? 'bg-brand text-white' : ''"
                  :style="spanStyle(s)"
                  @click="toggleSegment(s.id)"
                >
                  <span class="truncate">{{ s.id }}</span>
                </div>
              </div>

              <div
                v-for="s in matchedSegments"
                :key="`b-${s.id}`"
                class="flex flex-col gap-2 p-4 border border-border rounded-control"
                v-show="expandedSegId === s.id"
              >
                <div class="flex items-center gap-3">
                  <NTag type="info" size="small" :bordered="false" class="flex-none w-fit">{{ s.id }}</NTag>
                  <span class="text-xs text-ink-2 num">{{ s.windowStart }} – {{ s.windowEnd }}s</span>
                  <div class="ml-auto w-55">
                    <SamplePlayer :url="s.exists ? s.url : null" />
                  </div>
                </div>
                <p class="m-0 text-sm text-ink">{{ s.text }}</p>
                <div v-if="s.bounds.length" class="flex flex-wrap gap-2">
                  <NTooltip v-for="w in s.bounds" :key="w.start" placement="top">
                    <template #trigger>
                      <span class="px-2 py-1 rounded-control bg-neutral-soft text-ink-2 text-xs cursor-default">{{ w.text }}</span>
                    </template>
                    <span class="font-mono num">{{ w.start.toFixed(2) }} – {{ w.end.toFixed(2) }}s</span>
                  </NTooltip>
                </div>
              </div>

              <div class="flex flex-col">
                <div class="grid grid-cols-[72px_150px_1fr_64px] gap-3 p-2 items-center text-xs text-ink-3">
                  <span>段落</span>
                  <span>时间窗</span>
                  <span>台词</span>
                  <span>词数</span>
                </div>
                <div
                  v-for="s in matchedSegments"
                  :key="`row-${s.id}`"
                  class="p-2 rounded-control cursor-pointer transition duration-150"
                  :class="expandedSegId === s.id ? 'bg-brand-soft' : 'hover:bg-neutral-soft'"
                  @click="toggleSegment(s.id)"
                >
                  <div class="grid grid-cols-[72px_150px_1fr_64px] gap-3 items-center text-sm text-ink">
                    <span class="font-mono truncate">{{ s.id }}</span>
                    <span class="text-ink-2 text-xs num">{{ s.windowStart }} – {{ s.windowEnd }}s</span>
                    <span class="truncate">{{ s.text }}</span>
                    <span class="text-ink-2 text-xs num">{{ s.bounds.length }}</span>
                  </div>
                </div>
              </div>
            </div>
          </NCard>

          <!-- 产物 -->
          <NCard title="产物">
            <div v-if="detail!.artifacts.length" class="flex flex-col gap-4">
              <div v-for="a in detail!.artifacts" :key="a.name" class="flex flex-col gap-2 p-3 border border-border rounded-control">
                <div class="flex items-center gap-2">
                  <NIcon :size="15" class="flex-none text-ink-3">
                    <DocumentOutline />
                  </NIcon>
                  <span class="flex-1 min-w-0 text-sm text-ink truncate font-mono">{{ a.name }}</span>
                  <span class="flex-none text-xs text-ink-2 num">{{ probeMeta(a) }}</span>
                </div>
                <video v-if="a.type === 'video'" :src="a.url" controls class="max-w-full" />
                <NImage v-else-if="a.type === 'image'" :src="a.url" :width="200" object-fit="contain" />
                <div v-else-if="a.type === 'audio'" class="flex flex-col gap-2 w-full">
                  <SamplePlayer :url="a.url" />
                </div>
              </div>
            </div>
            <NEmpty v-else description="暂无产物" />
          </NCard>

        </div>
      </section>
    </div>
  </div>
</template>

