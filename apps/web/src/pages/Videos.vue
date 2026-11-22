<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NSelect, NImage, NIcon, NTooltip, NButton, NInputNumber, useMessage } from 'naive-ui';
import { FilmOutline, DocumentOutline } from '@vicons/ionicons5';
import { listVideos, getVideoDetail } from '../api/videos';
import { listSegments } from '../api/tts';
import { submitJob } from '../api/jobs';
import { useFetch } from '../composables/useFetch';
import SectionCard from '../components/data/SectionCard.vue';
import StatusTag from '../components/data/StatusTag.vue';
import SkeletonBlock from '../components/data/SkeletonBlock.vue';
import EmptyState from '../components/data/EmptyState.vue';
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
  <div class="videos">
    <div class="videos__body">
      <!-- 左侧列表 -->
      <aside class="videos__list">
        <NInput
          v-model:value="query"
          placeholder="按标题过滤"
          clearable
          size="small"
          class="videos__filter"
        />
        <NSelect
          v-model:value="sortBy"
          :options="sortOptions"
          size="small"
          class="videos__sort"
        />

        <EmptyState v-if="error" tone="danger" :description="error">
          <template #action>
            <n-button type="primary" size="small" @click="run">重试</n-button>
          </template>
        </EmptyState>

        <div v-else-if="loading" class="videos__items">
          <div v-for="i in 4" :key="i" class="video-item video-item--skeleton">
            <SkeletonBlock :rows="2" />
          </div>
        </div>

        <div v-else-if="filtered.length" class="videos__items">
          <button
            v-for="v in filtered"
            :key="v.id"
            type="button"
            class="video-item"
            :class="{ 'video-item--active': v.id === activeId }"
            @click="select(v.id)"
          >
            <div class="video-item__thumb">
              <img v-if="v.preview?.url" :src="v.preview.url" :alt="v.title" />
              <NIcon v-else :size="20" class="video-item__placeholder">
                <FilmOutline />
              </NIcon>
            </div>
            <div class="video-item__info">
              <div class="video-item__title">{{ v.title }}</div>
              <div class="video-item__meta tnum">
                {{ v.duration ?? '—' }}s · {{ v.sceneCount }} 场景 · {{ v.captionCount }} 字幕
              </div>
            </div>
          </button>
        </div>

        <EmptyState v-else description="暂无视频条目" />
      </aside>

      <!-- 右侧详情 -->
      <section class="videos__detail">
        <EmptyState v-if="!activeId" boxed description="从左侧选择一个视频条目查看详情" />

        <div v-else-if="detailLoading" class="detail-loading">
          <SkeletonBlock :rows="6" />
        </div>

        <EmptyState v-else-if="detailError" tone="danger" :description="detailError">
          <template #action>
            <n-button type="primary" size="small" @click="activeId && loadDetail(activeId)">重试</n-button>
          </template>
        </EmptyState>

        <div v-else-if="detail" class="detail">
          <!-- 播放器 -->
          <SectionCard>
            <div class="player">
              <video
                v-if="mainVideo"
                ref="mainVideoEl"
                :src="mainVideo.url"
                controls
                class="player__video"
                @timeupdate="onVideoTime"
                @loadedmetadata="onVideoMeta"
              />
              <div v-else class="player__empty">
                <NIcon :size="28" class="player__empty-icon">
                  <FilmOutline />
                </NIcon>
                <span>暂无成片</span>
              </div>
            </div>
          </SectionCard>

          <!-- 生成操作：命令按当前条目上下文触发，路径自动带入 -->
          <SectionCard title="生成操作">
            <div class="actions">
              <div class="actions__controls">
                <div class="actions__field">
                  <label class="actions__label">实例目录</label>
                  <NSelect v-model:value="selectedInstance" :options="instanceOptions" size="small" />
                </div>
                <div class="actions__field">
                  <label class="actions__label">预览时刻（秒）</label>
                  <NInputNumber v-model:value="previewTime" :min="0.1" :step="0.5" size="small" />
                </div>
              </div>
              <div class="actions__buttons">
                <NButton size="small" :loading="busyAction === 'plan'" @click="runAction('plan')">计划校验</NButton>
                <NButton size="small" :loading="busyAction === 'prepare'" @click="runAction('prepare')">准备实例</NButton>
                <NButton size="small" :loading="busyAction === 'preview'" @click="runAction('preview')">预览单帧</NButton>
                <NButton type="primary" size="small" :loading="busyAction === 'render'" @click="runAction('render')">渲染成片</NButton>
              </div>
            </div>
          </SectionCard>

          <!-- 元信息 -->
          <SectionCard title="工程信息">
            <div class="meta-grid">
              <div class="meta">
                <span class="meta__label">布局</span>
                <span class="meta__value">{{ detail.meta.layout || '—' }}</span>
              </div>
              <div class="meta">
                <span class="meta__label">时长</span>
                <span class="meta__value tnum">{{ detail.meta.duration ?? '—' }}s</span>
              </div>
              <div class="meta">
                <span class="meta__label">场景</span>
                <span class="meta__value tnum">{{ detail.meta.scenes?.length ?? 0 }}</span>
              </div>
              <div class="meta">
                <span class="meta__label">字幕</span>
                <span class="meta__value tnum">{{ captions.length }}</span>
              </div>
            </div>
            <div class="meta meta--column">
              <span class="meta__label">输入文件</span>
              <PathCopy :path="detail.inputFile" />
            </div>
            <div v-if="detail.instanceDirs?.length" class="meta meta--column">
              <span class="meta__label">实例目录</span>
              <div class="meta__tags">
                <StatusTag v-for="d in detail.instanceDirs" :key="d" status="neutral" :text="d" />
              </div>
            </div>
          </SectionCard>

          <!-- 背景音乐 -->
          <SectionCard v-if="bgm" title="背景音乐">
            <div class="bgm">
              <div class="bgm__head">
                <StatusTag status="neutral" :text="bgm.file" />
                <span v-if="bgmLicense" class="bgm__license">{{ bgmLicense }}</span>
              </div>
              <SamplePlayer :url="bgm.url" />
            </div>
          </SectionCard>

          <!-- 引用素材 -->
          <SectionCard title="引用素材">
            <div v-if="mediaViews.length" class="media-grid">
              <div v-for="m in mediaViews" :key="m.file" class="media">
                <div class="media__head">
                  <StatusTag :status="m.exists ? 'neutral' : 'danger'" :text="m.role" />
                  <span class="media__file mono">{{ m.file }}</span>
                </div>
                <div class="media__body">
                  <NImage
                    v-if="m.type === 'image' && m.url"
                    :src="m.url"
                    :width="120"
                    object-fit="contain"
                  />
                  <div v-else-if="m.type === 'audio' && m.url" class="media__audio-wrap">
                    <SamplePlayer :url="m.url" />
                  </div>
                  <audio v-else-if="m.url" controls class="media__audio">
                    <source :src="m.url" />
                  </audio>
                  <div v-else class="media__missing">
                    <StatusTag status="danger" text="缺失" />
                    <span class="mono">{{ m.file }}</span>
                  </div>
                </div>
              </div>
            </div>
            <EmptyState v-else description="无引用素材" />
          </SectionCard>

          <!-- 字幕 -->
          <SectionCard :title="`字幕（${captions.length}）`">
            <TimelineTrack
              v-if="captions.length"
              class="captions__track"
              :items="captionItems"
              :duration="trackDuration"
              :active-id="activeCaption >= 0 ? String(activeCaption) : null"
              :current-time="mainTime"
              :height="36"
              @seek="seekTo"
            />
            <div v-if="captions.length" class="captions">
              <div class="captions__head">
                <span class="captions__col captions__col--time">开始</span>
                <span class="captions__col captions__col--time">结束</span>
                <span class="captions__col">文本</span>
              </div>
              <button
                v-for="(c, i) in captions"
                :key="i"
                type="button"
                class="caption-row"
                :class="{ 'caption-row--active': activeCaption === i }"
                @click="seekTo(c.start)"
              >
                <span class="caption-row__time tnum">{{ c.start.toFixed(2) }}</span>
                <span class="caption-row__time tnum">{{ c.end.toFixed(2) }}</span>
                <span class="caption-row__text">{{ c.text }}</span>
              </button>
            </div>
            <EmptyState v-else description="暂无字幕" />
          </SectionCard>

          <!-- 配音分段与词边界 -->
          <SectionCard
            v-if="matchedSegments.length"
            :title="`配音分段与词边界（${matchedSegments.length}）`"
          >
            <div class="segments">
              <div class="timeline">
                <div
                  v-for="s in matchedSegments"
                  :key="s.id"
                  class="timeline__span"
                  :class="{ 'timeline__span--active': expandedSegId === s.id }"
                  :style="spanStyle(s)"
                  @click="toggleSegment(s.id)"
                >
                  <span class="timeline__id">{{ s.id }}</span>
                </div>
              </div>

              <div
                v-for="s in matchedSegments"
                :key="`b-${s.id}`"
                class="segment"
                v-show="expandedSegId === s.id"
              >
                <div class="segment__head">
                  <StatusTag status="info" :text="s.id" />
                  <span class="segment__time tnum">{{ s.windowStart }} – {{ s.windowEnd }}s</span>
                  <div class="segment__player">
                    <SamplePlayer :url="s.exists ? s.url : null" />
                  </div>
                </div>
                <p class="segment__text">{{ s.text }}</p>
                <div v-if="s.bounds.length" class="chips">
                  <NTooltip v-for="w in s.bounds" :key="w.start" placement="top">
                    <template #trigger>
                      <span class="chip">{{ w.text }}</span>
                    </template>
                    <span class="mono tnum">{{ w.start.toFixed(2) }} – {{ w.end.toFixed(2) }}s</span>
                  </NTooltip>
                </div>
              </div>

              <div class="seg-table">
                <div class="seg-table__head">
                  <span class="seg-table__col seg-table__col--id">段落</span>
                  <span class="seg-table__col seg-table__col--time">时间窗</span>
                  <span class="seg-table__col">台词</span>
                  <span class="seg-table__col seg-table__col--words">词数</span>
                </div>
                <button
                  v-for="s in matchedSegments"
                  :key="`row-${s.id}`"
                  type="button"
                  class="seg-table__row"
                  :class="{ 'seg-table__row--active': expandedSegId === s.id }"
                  @click="toggleSegment(s.id)"
                >
                  <span class="seg-table__col seg-table__col--id mono">{{ s.id }}</span>
                  <span class="seg-table__col seg-table__col--time tnum">{{ s.windowStart }} – {{ s.windowEnd }}s</span>
                  <span class="seg-table__col seg-table__col--text">{{ s.text }}</span>
                  <span class="seg-table__col seg-table__col--words tnum">{{ s.bounds.length }}</span>
                </button>
              </div>
            </div>
          </SectionCard>

          <!-- 产物 -->
          <SectionCard title="产物">
            <div v-if="detail.artifacts.length" class="artifacts">
              <div v-for="a in detail.artifacts" :key="a.name" class="artifact">
                <div class="artifact__head">
                  <NIcon :size="15" class="artifact__icon">
                    <DocumentOutline />
                  </NIcon>
                  <span class="artifact__name mono">{{ a.name }}</span>
                  <span class="artifact__probe tnum">{{ probeMeta(a) }}</span>
                </div>
                <video v-if="a.type === 'video'" :src="a.url" controls class="artifact__media" />
                <NImage v-else-if="a.type === 'image'" :src="a.url" :width="200" object-fit="contain" />
                <div v-else-if="a.type === 'audio'" class="artifact__audio-wrap">
                  <SamplePlayer :url="a.url" />
                </div>
              </div>
            </div>
            <EmptyState v-else description="暂无产物" />
          </SectionCard>

        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.videos {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.videos__body {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

@media (max-width: 960px) {
  .videos__body {
    grid-template-columns: 1fr;
  }
}

.videos__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.videos__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.video-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  text-align: left;
  background: var(--color-panel);
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition);
}

.video-item:hover {
  border-color: var(--color-border);
}

.video-item--active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
}

.video-item__thumb {
  width: 96px;
  height: 54px;
  flex: none;
  border-radius: var(--radius-tag);
  background: var(--color-divider);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.video-item__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-item__placeholder {
  color: var(--color-text-tertiary);
}

.video-item__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.video-item__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.video-item__meta {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.detail-loading {
  padding: 16px;
}

.player {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-divider);
  border-radius: var(--radius-control);
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.player__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.player__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--color-text-tertiary);
  font-size: 13px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
}

.actions__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.actions__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 160px;
}

.actions__label {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.actions__buttons {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 4px 0;
}

.meta--column {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.meta__label {
  flex: none;
  font-size: 12px;
  color: var(--color-text-tertiary);
  width: 64px;
}

.meta__value {
  color: var(--color-text-primary);
}

.meta__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.media {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.media__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.media__file {
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media__body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 5rem;
}

.media__audio {
  width: 100%;
}

.media__missing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.captions__track {
  margin-bottom: 12px;
}

.captions {
  display: flex;
  flex-direction: column;
}

.captions__head,
.caption-row {
  display: grid;
  grid-template-columns: 80px 80px 1fr;
  gap: 12px;
  padding: 8px 10px;
}

.captions__head {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.caption-row {
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--radius-tag);
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-primary);
}

.caption-row:hover {
  background: var(--color-neutral-soft);
}

.caption-row--active {
  background: var(--color-brand-soft);
}

.caption-row__time {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.artifacts {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.artifact {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.artifact__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.artifact__icon {
  flex: none;
  color: var(--color-text-tertiary);
}

.artifact__name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artifact__probe {
  flex: none;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.artifact__media {
  max-width: 100%;
}

/* 配音分段与词边界 */
.segments {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.timeline {
  position: relative;
  height: 36px;
  border-radius: var(--radius-control);
  background: var(--color-divider);
  overflow: hidden;
}

.timeline__span {
  position: absolute;
  top: 4px;
  bottom: 4px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-radius: var(--radius-tag);
  background: var(--color-brand-soft);
  color: var(--color-brand);
  cursor: pointer;
  font-size: 12px;
  transition: background var(--transition);
}

.timeline__span--active {
  background: var(--color-brand);
  color: #fff;
}

.segment {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.segment__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.segment__time {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.segment__player {
  margin-left: auto;
  width: 220px;
}

.segment__text {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-primary);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 3px 10px;
  border-radius: var(--radius-tag);
  background: var(--color-neutral-soft);
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: default;
}

.seg-table {
  display: flex;
  flex-direction: column;
}

.seg-table__head,
.seg-table__row {
  display: grid;
  grid-template-columns: 72px 150px 1fr 64px;
  gap: 12px;
  padding: 10px;
  align-items: center;
}

.seg-table__head {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.seg-table__row {
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--radius-tag);
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-primary);
}

.seg-table__row:hover {
  background: var(--color-neutral-soft);
}

.seg-table__row--active {
  background: var(--color-brand-soft);
}

.seg-table__col--text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seg-table__col--time,
.seg-table__col--words {
  color: var(--color-text-secondary);
  font-size: 12px;
}

/* 背景音乐 */
.bgm {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bgm__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.bgm__license {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bgm__audio {
  width: 100%;
}

.media__audio-wrap,
.artifact__audio-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

</style>
