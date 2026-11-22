<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';
import { NIcon, NButton, NDrawer, NDrawerContent, NTree, useMessage, type TreeOption } from 'naive-ui';
import {
  FolderOutline,
  DocumentOutline,
  OpenOutline,
  DownloadOutline,
} from '@vicons/ionicons5';
import { listTemplates, getTemplateDetail, getTemplateRedirect } from '../api/templates';
import { useFetch } from '../composables/useFetch';
import StatusTag from '../components/data/StatusTag.vue';
import SkeletonBlock from '../components/data/SkeletonBlock.vue';
import EmptyState from '../components/data/EmptyState.vue';
import PathCopy from '../components/data/PathCopy.vue';
import type { TemplateDetail, FileNode, ParamField } from '../shared/types';
import { OFFICIAL_SITE } from '../shared/constants';

const { data, loading, error, run } = useFetch(listTemplates);

onMounted(run);

/* 抽屉详情 */
const show = ref(false);
const detail = ref<TemplateDetail | null>(null);
const detailLoading = ref(false);
const detailError = ref('');
const redirectUrl = ref<string | null>(null);

async function open(id: string) {
  show.value = true;
  detailLoading.value = true;
  detail.value = null;
  detailError.value = '';
  redirectUrl.value = null;
  try {
    const [d, r] = await Promise.all([
      getTemplateDetail(id),
      getTemplateRedirect(id).catch(() => null),
    ]);
    detail.value = d;
    redirectUrl.value = r?.redirectUrl ?? null;
  } catch (e) {
    detailError.value = e instanceof Error ? e.message : String(e);
  } finally {
    detailLoading.value = false;
  }
}

function originTone(origin: string): 'neutral' | 'warning' {
  return origin === 'cache' ? 'warning' : 'neutral';
}
function originLabel(origin: string): string {
  if (origin === 'local') return '本地';
  if (origin === 'cache') return '缓存';
  return origin;
}
function networkTag(network: boolean | null) {
  if (network === true) return { tone: 'info' as const, text: '需联网' };
  if (network === false) return { tone: 'neutral' as const, text: '离线' };
  return { tone: 'neutral' as const, text: '未知' };
}

function typeLabel(t: string | null): string {
  switch (t) {
    case 'string':
      return '文本';
    case 'number':
      return '数值';
    case 'boolean':
      return '开关';
    case 'array':
      return '数组';
    case 'object':
      return '对象';
    case 'const':
      return '常量';
    default:
      return '任意';
  }
}

function formatScalar(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function fieldSummary(f: ParamField): string[] {
  const bits: string[] = [];
  if (f.constValue != null) bits.push(`常量 ${f.constValue}`);
  else if (f.enum) bits.push(`枚举 ${f.enum.join(' / ')}`);
  if (f.defaultValue != null) bits.push(`默认 ${formatScalar(f.defaultValue)}`);
  if (f.range) bits.push(f.range);
  if (f.nested != null) bits.push(`含 ${f.nested} 个子项`);
  return bits;
}

/* 文件树 */
interface TreeNode {
  key: string;
  label: string;
  type: 'dir' | 'file';
  children?: TreeNode[];
  [key: string]: unknown;
}

const HIDDEN_FILES = new Set(['.DS_Store', 'Thumbs.db']);

function toNode(n: FileNode): TreeNode | null {
  if (HIDDEN_FILES.has(n.name)) return null;
  const children = (n.children ?? []).map(toNode).filter(Boolean) as TreeNode[];
  return {
    key: n.name,
    label: n.name,
    type: n.type,
    children: children.length ? children : undefined,
  };
}

const treeData = computed<TreeOption[]>(() =>
  (detail.value?.fileTree ?? []).map(toNode).filter((n): n is TreeNode => n !== null),
);

function renderPrefix(node: unknown) {
  const opt = (node as { option?: TreeNode }).option ?? (node as TreeNode);
  const type = opt.type;
  return h(
    NIcon,
    { size: 14, style: { color: 'var(--color-text-tertiary)' } },
    { default: () => h(type === 'dir' ? FolderOutline : DocumentOutline) },
  );
}

const outputText = computed(() => {
  const o = detail.value?.output as Record<string, unknown> | null | undefined;
  if (!o) return '—';
  const wh =
    o.width && o.height ? `${o.width}×${o.height}` : '';
  const fps = (o.fps as { num?: number; den?: number } | undefined)?.num
    ? `${(o.fps as { num: number; den?: number }).num}/${(o.fps as { den?: number }).den ?? 1} fps`
    : '';
  return [wh, fps].filter(Boolean).join(' · ') || '—';
});

const message = useMessage();
function onDownloadPlaceholder() {
  message.warning('本地下载接口待后端开放，当前请通过官网获取模板包');
}
</script>

<template>
  <div class="templates">
    <EmptyState v-if="error" tone="danger" :description="error" tip="模板清单加载失败">
      <template #action>
        <n-button type="primary" @click="run">重试</n-button>
      </template>
    </EmptyState>

    <div v-else-if="loading" class="tpl-grid">
      <div v-for="i in 4" :key="i" class="tpl-card tpl-card--skeleton">
        <SkeletonBlock :rows="3" />
      </div>
    </div>

    <template v-else-if="data">
      <div class="tpl-banner">
        <div class="tpl-banner__text">
          <span class="tpl-banner__title">需要更多模板？</span>
          <span class="tpl-banner__desc">前往 MotionGit 模板中心挑选 .motion 模板包，下载后缓存到本地</span>
        </div>
        <div class="tpl-banner__actions">
          <n-button size="small" quaternary @click="onDownloadPlaceholder">
            <template #icon>
              <n-icon :size="14"><DownloadOutline /></n-icon>
            </template>
            下载到本地
          </n-button>
          <n-button tag="a" :href="OFFICIAL_SITE" target="_blank" rel="noopener noreferrer" size="small" type="primary">
            <template #icon>
              <n-icon :size="14"><OpenOutline /></n-icon>
            </template>
            前往官网
          </n-button>
        </div>
      </div>

      <div v-if="data.length" class="tpl-grid">
        <button
          v-for="t in data"
          :key="t.id"
          type="button"
          class="tpl-card"
          @click="open(t.id)"
        >
          <div class="tpl-card__name">{{ t.name }}</div>

          <div class="tpl-card__badges">
            <StatusTag :status="originTone(t.origin)" :text="originLabel(t.origin)" />
            <StatusTag v-if="t.version" status="neutral" :text="t.version" />
            <StatusTag
              :status="networkTag(t.network).tone"
              :text="networkTag(t.network).text"
            />
          </div>

          <div class="tpl-card__meta">
            <span class="tpl-card__label">许可</span>
            <span class="mono tpl-card__value">{{ t.license || '—' }}</span>
          </div>
          <div class="tpl-card__meta">
            <span class="tpl-card__label">入口</span>
            <span class="mono tpl-card__value">{{ t.runtime.entry || '—' }}</span>
          </div>
        </button>
      </div>
      <EmptyState v-else description="暂无本地模板" tip="模板下载缓存后会出现在这里" />
    </template>

    <n-drawer v-model:show="show" :width="'min(560px, 92vw)'">
      <n-drawer-content closable>
        <template #header>
          <div class="drawer-header">
            <span class="drawer-header__title">{{ detail?.name ?? '模板详情' }}</span>
            <n-button v-if="redirectUrl" tag="a" :href="redirectUrl" target="_blank" rel="noopener noreferrer" size="small" quaternary>
              <template #icon>
                <n-icon :size="14"><OpenOutline /></n-icon>
              </template>
              原站
            </n-button>
          </div>
        </template>

        <div v-if="detailLoading" class="drawer-loading">
          <SkeletonBlock :rows="5" />
        </div>
        <EmptyState v-else-if="detailError" tone="danger" :description="detailError" />

        <div v-else-if="detail" class="drawer-body">
          <section class="block">
            <h3 class="block__title">身份</h3>
            <div class="row">
              <span class="row__label">ID</span>
              <span class="mono row__value">{{ detail.id }}</span>
            </div>
            <div class="row">
              <span class="row__label">版本</span>
              <span class="row__value">{{ detail.version || '—' }}</span>
            </div>
            <div class="row">
              <span class="row__label">来源</span>
              <StatusTag :status="originTone(detail.origin)" :text="originLabel(detail.origin)" />
            </div>
            <div class="row row--column">
              <span class="row__label">路径</span>
              <PathCopy :path="detail.localPath" />
            </div>
          </section>

          <section class="block">
            <h3 class="block__title">运行时</h3>
            <div class="row">
              <span class="row__label">Profile</span>
              <span class="mono row__value">{{ detail.runtime.profile || '—' }}</span>
            </div>
            <div class="row">
              <span class="row__label">入口</span>
              <span class="mono row__value">{{ detail.runtime.entry || '—' }}</span>
            </div>
            <div class="row">
              <span class="row__label">网络</span>
              <StatusTag :status="networkTag(detail.network).tone" :text="networkTag(detail.network).text" />
            </div>
            <div class="row">
              <span class="row__label">输出</span>
              <span class="row__value">{{ outputText }}</span>
            </div>
          </section>

          <section class="block">
            <h3 class="block__title">参数</h3>
            <div v-if="detail.parameters.file" class="row row--column">
              <span class="row__label">Schema</span>
              <PathCopy :path="detail.parameters.file" />
            </div>
            <EmptyState
              v-if="!detail.parameters.fields.length"
              description="未声明参数 schema"
            />
            <div v-else class="param-list">
              <div v-for="f in detail.parameters.fields" :key="f.name" class="param-item">
                <div class="param-item__head">
                  <span class="mono param-item__name">{{ f.name }}</span>
                  <StatusTag
                    :status="f.required ? 'warning' : 'neutral'"
                    :text="f.required ? '必填' : '可选'"
                  />
                  <StatusTag status="neutral" :text="typeLabel(f.type)" />
                </div>
                <div v-if="fieldSummary(f).length" class="param-item__meta">
                  <span v-for="bit in fieldSummary(f)" :key="bit">{{ bit }}</span>
                </div>
                <p v-if="f.description" class="param-item__desc">{{ f.description }}</p>
              </div>
            </div>
          </section>

          <section class="block">
            <h3 class="block__title">许可</h3>
            <div class="row row--column">
              <span class="row__label">许可文件</span>
              <PathCopy :path="detail.license.file || '—'" />
            </div>
            <div class="row">
              <span class="row__label">状态</span>
              <StatusTag
                :status="detail.license.present ? 'success' : 'danger'"
                :text="detail.license.present ? '已包含' : '缺失'"
              />
            </div>
          </section>

          <section class="block">
            <h3 class="block__title">文件树</h3>
            <n-tree
              :data="treeData"
              :render-prefix="renderPrefix"
              default-expand-all
              :selectable="false"
            />
          </section>
        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style scoped>
.templates {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.tpl-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 20px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.tpl-banner__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.tpl-banner__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tpl-banner__desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.tpl-banner__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.tpl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.tpl-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  text-align: left;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: border-color var(--transition), transform var(--transition);
}

.tpl-card:hover {
  border-color: var(--color-brand);
  transform: translateY(-1px);
}

.tpl-card--skeleton {
  cursor: default;
}

.tpl-card--skeleton:hover {
  transform: none;
}

.tpl-card__name {
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: var(--color-text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tpl-card__badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.tpl-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.tpl-card__label {
  flex: none;
  color: var(--color-text-tertiary);
  width: 36px;
}

.tpl-card__value {
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-loading {
  padding: 8px 0;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.drawer-header__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.block__title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
}

.row--column {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.row__label {
  flex: none;
  width: 72px;
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.row__value {
  color: var(--color-text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.param-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.param-item__head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.param-item__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.param-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.param-item__desc {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
}
</style>
