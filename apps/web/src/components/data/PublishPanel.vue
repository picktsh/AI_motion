<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NButton, NImage, NInput, NModal, NSpin, useMessage } from 'naive-ui';
import SectionCard from './SectionCard.vue';
import StatusTag from './StatusTag.vue';
import { getVideoDetail, uploadVideoAsset } from '../../api/videos';
import { getPublish, savePublish, type PublishSource } from '../../api/publish';
import type { VideoDetail, PublishConfig } from '../../shared/types';

const props = defineProps<{ entryId: string; fallbackTitle?: string }>();

const message = useMessage();

const detail = ref<VideoDetail | null>(null);
const publish = ref<PublishConfig | null>(null);
const publishSource = ref<PublishSource | null>(null);
const editing = ref(false);
const saving = ref(false);
const uploading = ref(false);
const draft = reactive({ title: '', body: '', hashtags: [] as string[], horizontal: '', vertical: '', notes: '' });
const tagInput = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const pendingKind = ref<'horizontal' | 'vertical'>('horizontal');

/* ---------- 素材库 ---------- */
interface ImageAsset {
  name: string;
  url: string;
  source: '引用素材' | '输入素材' | '产物';
}

const images = computed<ImageAsset[]>(() => {
  const d = detail.value;
  if (!d) return [];
  const seen = new Set<string>();
  const out: ImageAsset[] = [];
  const push = (name: string, url: string | null, source: ImageAsset['source']) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ name, url, source });
  };
  for (const m of d.mediaRefs) if (m.type === 'image') push(m.file, m.url, '引用素材');
  for (const e of d.extraAssets) if (e.type === 'image') push(e.name, e.url, '输入素材');
  for (const a of d.artifacts) if (a.type === 'image') push(a.name, a.url, '产物');
  return out;
});

function imageByName(name: string | undefined): ImageAsset | null {
  if (!name) return null;
  return images.value.find((i) => i.name === name) ?? null;
}

/** 只认显式选中的封面，不再用 cover.png 之类的默认图兜底。 */
function coverUrl(kind: 'horizontal' | 'vertical'): string | null {
  const name = kind === 'horizontal' ? draft.horizontal : draft.vertical;
  return imageByName(name)?.url ?? null;
}

const coverName = (kind: 'horizontal' | 'vertical'): string =>
  kind === 'horizontal' ? draft.horizontal : draft.vertical;

const coverMissingName = (kind: 'horizontal' | 'vertical'): boolean => {
  const name = coverName(kind);
  return Boolean(name) && !imageByName(name);
};

/* ---------- 封面选择弹窗 ---------- */
const picker = reactive({ show: false, kind: 'horizontal' as 'horizontal' | 'vertical' });
const pickerTitle = computed(() => (picker.kind === 'horizontal' ? '选择横屏封面' : '选择竖屏封面'));

function openPicker(kind: 'horizontal' | 'vertical') {
  picker.kind = kind;
  picker.show = true;
}

function chooseCover(img: ImageAsset) {
  if (picker.kind === 'horizontal') draft.horizontal = img.name;
  else draft.vertical = img.name;
  picker.show = false;
}

function clearCover(kind: 'horizontal' | 'vertical') {
  if (kind === 'horizontal') draft.horizontal = '';
  else draft.vertical = '';
}

function triggerUpload(kind: 'horizontal' | 'vertical') {
  pendingKind.value = kind;
  fileInput.value?.click();
}

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  uploading.value = true;
  try {
    const saved = await uploadVideoAsset(props.entryId, file, (p) => {
      if (p >= 100) message.success(`已上传 ${file.name}`);
    });
    await refreshDetail();
    if (pendingKind.value === 'horizontal') draft.horizontal = saved.name;
    else draft.vertical = saved.name;
    message.success(`已导入并选为${pendingKind.value === 'horizontal' ? '横屏' : '竖屏'}封面：${saved.name}`);
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err));
  } finally {
    uploading.value = false;
  }
}

/* ---------- 读取与保存 ---------- */
function fillDraft(c: PublishConfig) {
  draft.title = c.title ?? '';
  draft.body = c.body ?? '';
  draft.hashtags = [...(c.hashtags ?? [])];
  draft.horizontal = c.covers?.horizontal ?? '';
  draft.vertical = c.covers?.vertical ?? '';
  draft.notes = c.notes ?? '';
  tagInput.value = '';
}

async function refreshDetail() {
  try {
    detail.value = await getVideoDetail(props.entryId);
  } catch {
    detail.value = null;
  }
}

async function loadAll() {
  await refreshDetail();
  publish.value = null;
  editing.value = false;
  try {
    const res = await getPublish(props.entryId);
    const c = res.config ?? {};
    const empty =
      !c.title?.trim() &&
      !c.body?.trim() &&
      !(c.hashtags?.length) &&
      !c.notes?.trim() &&
      !c.covers?.horizontal &&
      !c.covers?.vertical;
    publish.value = empty ? null : c;
    publishSource.value = res.source;
    fillDraft(c);
  } catch {
    publishSource.value = null;
    fillDraft({});
  }
}

watch(() => props.entryId, () => void loadAll(), { immediate: true });

function startEdit() {
  fillDraft(publish.value ?? {});
  editing.value = true;
}

function cancelEdit() {
  fillDraft(publish.value ?? {});
  editing.value = false;
}

function addTag() {
  const raw = tagInput.value.trim().replace(/^#/, '');
  if (!raw) return;
  if (!draft.hashtags.includes(raw)) draft.hashtags.push(raw);
  tagInput.value = '';
}

function removeTag(tag: string) {
  draft.hashtags = draft.hashtags.filter((t) => t !== tag);
}

async function saveEdit() {
  saving.value = true;
  try {
    const config: PublishConfig = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      notes: draft.notes.trim(),
      hashtags: draft.hashtags,
      covers: {
        ...(draft.horizontal ? { horizontal: draft.horizontal } : {}),
        ...(draft.vertical ? { vertical: draft.vertical } : {}),
      },
    };
    const res = await savePublish(props.entryId, config);
    publish.value = res.config;
    publishSource.value = res.source;
    editing.value = false;
    fillDraft(res.config);
    message.success('发布配置已保存');
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

const publishChecks = computed(() => {
  const p = publish.value;
  if (!p) return [];
  const has = (kind: 'horizontal' | 'vertical') => {
    const name = p.covers?.[kind];
    return Boolean(name) && Boolean(imageByName(name));
  };
  return [
    { label: '标题', ok: !!p.title?.trim() },
    { label: '正文', ok: !!p.body?.trim() },
    { label: '话题', ok: !!p.hashtags?.length },
    { label: '横封面', ok: has('horizontal') },
    { label: '竖封面', ok: has('vertical') },
  ];
});

const defaultCoverHint = computed(() => images.value.some((i) => i.name === 'cover.png'));
</script>

<template>
  <SectionCard title="发布配置">
    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      class="pub__file"
      @change="onFilePicked"
    />

    <!-- 编辑态 -->
    <template v-if="editing">
      <div class="pub-edit">
        <section class="pub-block">
          <h3 class="pub-block__title">文案</h3>
          <div class="pub-field">
            <span class="pub-field__label">标题</span>
            <NInput v-model:value="draft.title" size="small" :placeholder="fallbackTitle || '发布标题'" />
          </div>
          <div class="pub-field pub-field--column">
            <span class="pub-field__label">正文</span>
            <NInput v-model:value="draft.body" type="textarea" :rows="4" size="small" placeholder="发布正文，换行会保留" />
          </div>
          <div class="pub-field pub-field--column">
            <span class="pub-field__label">话题</span>
            <div class="pub-tags">
              <span v-for="t in draft.hashtags" :key="t" class="pub-tag">
                #{{ t }}
                <button type="button" class="pub-tag__x" @click="removeTag(t)">×</button>
              </span>
              <span v-if="!draft.hashtags.length" class="pub-tags__empty">还没加话题</span>
            </div>
            <NInput
              v-model:value="tagInput"
              size="small"
              placeholder="输入话题后回车，例如 AI剪辑"
              @keyup.enter="addTag"
            />
          </div>
          <div class="pub-field pub-field--column">
            <span class="pub-field__label">备注</span>
            <NInput v-model:value="draft.notes" type="textarea" :rows="2" size="small" placeholder="给自己看的备注，不影响发布" />
          </div>
        </section>

        <section class="pub-block">
          <h3 class="pub-block__title">封面</h3>
          <p class="pub-block__tip">从本作品已有素材里选，或直接导入本机图片；导入会落在该作品的 input 目录。</p>
          <div class="cover-grid">
            <div v-for="k in (['horizontal', 'vertical'] as const)" :key="k" class="cover-slot">
              <div class="cover-slot__head">
                <span>{{ k === 'horizontal' ? '横屏封面' : '竖屏封面' }}</span>
                <span class="cover-slot__ratio">{{ k === 'horizontal' ? '建议 16:9' : '建议 9:16' }}</span>
              </div>
              <button type="button" class="cover-slot__preview" @click="openPicker(k)">
                <NImage
                  v-if="coverUrl(k)"
                  :src="coverUrl(k) || ''"
                  :img-props="{ style: k === 'horizontal' ? 'width:100%;height:100%;object-fit:cover;' : 'width:100%;height:100%;object-fit:contain;' }"
                />
                <span v-else-if="coverMissingName(k)" class="cover-slot__empty">
                  素材不存在：{{ coverName(k) }}
                </span>
                <span v-else class="cover-slot__empty">点击从素材库选择</span>
              </button>
              <div class="cover-slot__actions">
                <NButton size="tiny" @click="openPicker(k)">素材库</NButton>
                <NButton size="tiny" quaternary :loading="uploading" @click="triggerUpload(k)">本机导入</NButton>
                <NButton v-if="coverName(k)" size="tiny" quaternary @click="clearCover(k)">清除</NButton>
              </div>
              <div v-if="coverName(k)" class="cover-slot__name tnum">{{ coverName(k) }}</div>
            </div>
          </div>
          <p v-if="defaultCoverHint" class="pub-block__tip pub-block__tip--muted">
            素材里有 cover.png，需要的话在「素材库」里点选才会使用，不会自动套用。
          </p>
        </section>

        <div class="pub-actions">
          <NButton size="small" @click="cancelEdit">取消</NButton>
          <NButton size="small" type="primary" :loading="saving" @click="saveEdit">保存发布配置</NButton>
        </div>
      </div>
    </template>

    <!-- 展示态 -->
    <template v-else-if="publish">
      <div class="pub__toolbar">
        <div class="pub__checks">
          <span
            v-for="c in publishChecks"
            :key="c.label"
            class="pub-check"
            :class="c.ok ? 'pub-check--ok' : 'pub-check--miss'"
          >
            <span class="pub-check__dot" />{{ c.label }}{{ c.ok ? '齐备' : '缺失' }}
          </span>
        </div>
        <NButton size="small" @click="startEdit">编辑</NButton>
      </div>
      <div v-if="publishSource?.rel" class="pub__source tnum">{{ publishSource.rel }}</div>

      <div class="pub__row">
        <span class="pub-field__label">标题</span>
        <span class="pub__text">{{ publish.title || fallbackTitle || '—' }}</span>
      </div>
      <div class="pub__row pub__row--column">
        <span class="pub-field__label">正文</span>
        <p class="pub__body">{{ publish.body || '—' }}</p>
      </div>
      <div class="pub__row pub__row--column">
        <span class="pub-field__label">话题</span>
        <div class="pub__tags">
          <StatusTag
            v-for="t in publish.hashtags ?? []"
            :key="t"
            status="info"
            :text="`#${t.replace(/^#/, '')}`"
          />
          <span v-if="!publish.hashtags?.length" class="pub__empty">未配置</span>
        </div>
      </div>

      <div class="pub__covers">
        <div v-for="k in (['horizontal', 'vertical'] as const)" :key="k" class="pub-cover">
          <span class="pub-cover__label">{{ k === 'horizontal' ? '横屏封面' : '竖屏封面' }}</span>
          <div class="pub-cover__box">
            <NImage
              v-if="imageByName(publish.covers?.[k])"
              :src="imageByName(publish.covers?.[k])?.url || ''"
              :img-props="{ style: 'width:100%;height:100%;object-fit:contain;' }"
            />
            <span v-else class="pub-cover__missing">
              {{ publish.covers?.[k] ? `素材不存在：${publish.covers?.[k]}` : '未选择封面' }}
            </span>
          </div>
          <span v-if="publish.covers?.[k]" class="pub-cover__name tnum">{{ publish.covers?.[k] }}</span>
        </div>
      </div>

      <div v-if="publish.notes" class="pub__row pub__row--column">
        <span class="pub-field__label">备注</span>
        <p class="pub__note">{{ publish.notes }}</p>
      </div>
    </template>

    <!-- 空态：显眼入口 -->
    <div v-else class="pub-empty">
      <div class="pub-empty__title">这个作品还没有发布配置</div>
      <p class="pub-empty__tip">
        配好后会写到 studio/videos/&lt;作品&gt;/input/publish.json，标题、正文、话题、封面、备注都只影响发布，不动渲染输入。
      </p>
      <NButton type="primary" size="large" class="pub-empty__cta" @click="startEdit">开始配置发布信息</NButton>
      <p class="pub-empty__sub">封面可以从作品素材库里挑，也可以直接导入本机图片。</p>
    </div>

    <!-- 封面选择弹窗 -->
    <NModal v-model:show="picker.show" preset="card" :title="pickerTitle" class="pub-picker">
      <NSpin :show="uploading">
        <div v-if="!images.length" class="pub-picker__empty">
          这个作品还没有图片素材，点下方「导入本机图片」加一张。
        </div>
        <div v-else class="pub-picker__grid">
          <button
            v-for="img in images"
            :key="img.url"
            type="button"
            class="pub-picker__cell"
            :class="{ 'pub-picker__cell--active': coverName(picker.kind) === img.name }"
            @click="chooseCover(img)"
          >
            <img :src="img.url" :alt="img.name" loading="lazy" />
            <span class="pub-picker__name tnum">{{ img.name }}</span>
            <span class="pub-picker__source">{{ img.source }}</span>
          </button>
        </div>
      </NSpin>
      <template #footer>
        <div class="pub-picker__footer">
          <NButton size="small" :loading="uploading" @click="triggerUpload(picker.kind)">导入本机图片</NButton>
          <NButton size="small" quaternary @click="picker.show = false">取消</NButton>
        </div>
      </template>
    </NModal>
  </SectionCard>
</template>

<style scoped>
.pub__file {
  display: none;
}

/* 空态 */
.pub-empty {
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-control);
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  background: var(--color-neutral-soft);
}

.pub-empty__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.pub-empty__tip {
  margin: 0;
  max-width: 520px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-text-tertiary);
}

.pub-empty__cta {
  margin-top: 10px;
  padding: 0 28px;
}

.pub-empty__sub {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* 编辑态 */
.pub-edit {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pub-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pub-block__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.pub-block__tip {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.pub-block__tip--muted {
  margin-top: 4px;
}

.pub-field {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pub-field--column {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.pub-field__label {
  flex: 0 0 64px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.pub-field NInput {
  flex: 1;
}

.pub-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 24px;
}

.pub-tags__empty {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.pub-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 8px;
  border-radius: 999px;
  background: var(--color-brand-soft);
  color: var(--color-brand);
  font-size: 12px;
}

.pub-tag__x {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0 2px;
}

/* 封面槽 */
.cover-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.cover-slot {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cover-slot__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.cover-slot__ratio {
  color: var(--color-text-tertiary);
}

.cover-slot__preview {
  width: 100%;
  height: 200px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-neutral-soft);
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-slot__empty {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.cover-slot__actions {
  display: flex;
  gap: 6px;
}

.cover-slot__name {
  font-size: 12px;
  color: var(--color-text-tertiary);
  word-break: break-all;
}

.pub-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

/* 展示态 */
.pub__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.pub__checks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.pub-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.pub-check__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.pub-check--ok {
  color: var(--color-success);
}

.pub-check--ok .pub-check__dot {
  background: var(--color-success);
}

.pub-check--miss {
  color: var(--color-warning);
}

.pub-check--miss .pub-check__dot {
  background: var(--color-warning);
}

.pub__source {
  font-size: 12px;
  color: var(--color-text-tertiary);
  word-break: break-all;
  margin-bottom: 12px;
}

.pub__row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--color-border-soft);
}

.pub__row--column {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.pub__row--column .pub-field__label {
  flex: 0 0 auto;
}

.pub__text {
  font-size: 13px;
  color: var(--color-text-primary);
}

.pub__body {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-text-primary);
  white-space: pre-wrap;
}

.pub__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pub__empty {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.pub__covers {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid var(--color-border-soft);
}

.pub-cover {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pub-cover__label {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.pub-cover__box {
  width: 100%;
  height: 200px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-control);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-neutral-soft);
}

.pub-cover__missing {
  font-size: 12px;
  color: var(--color-text-tertiary);
  text-align: center;
  padding: 0 8px;
}

.pub-cover__name {
  font-size: 12px;
  color: var(--color-text-tertiary);
  word-break: break-all;
}

.pub__note {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
}

/* 选择弹窗 */
.pub-picker__empty {
  padding: 32px 0;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.pub-picker__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  max-height: 480px;
  overflow: auto;
}

.pub-picker__cell {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: 6px;
  background: var(--color-neutral-soft);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.pub-picker__cell--active {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 1px var(--color-brand);
}

.pub-picker__cell img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 4px;
  background: #000;
}

.pub-picker__name {
  font-size: 11px;
  color: var(--color-text-secondary);
  word-break: break-all;
}

.pub-picker__source {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.pub-picker__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 960px) {
  .cover-grid,
  .pub__covers,
  .pub-picker__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
