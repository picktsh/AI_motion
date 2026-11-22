<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NIcon, NButton, NDrawer, NDrawerContent, NInput, NTree, NProgress, useMessage, type TreeOption } from 'naive-ui';
import {
  FolderOutline,
  DocumentOutline,
  OpenOutline,
  DownloadOutline,
  CloudUploadOutline,
  RefreshOutline,
  SearchOutline,
  CopyOutline,
  PlayCircleOutline,
} from '@vicons/ionicons5';
import {
  listTemplates,
  getCatalog,
  importTemplate,
  getTemplateDetail,
  getTemplateRedirect,
} from '../api/templates';
import { useFetch } from '../composables/useFetch';
import StatusTag from '../components/data/StatusTag.vue';
import SkeletonBlock from '../components/data/SkeletonBlock.vue';
import EmptyState from '../components/data/EmptyState.vue';
import PathCopy from '../components/data/PathCopy.vue';
import type {
  TemplateDetail,
  TemplateSummary,
  CatalogItem,
  FileNode,
  ParamField,
} from '../shared/types';
import { OFFICIAL_SITE } from '../shared/constants';

const message = useMessage();
const router = useRouter();

function useTemplate() {
  if (!detail.value) return;
  const id = detail.value.id;
  show.value = false;
  router.push({ path: '/', query: { template: id } });
}

const local = useFetch(listTemplates);
const catalog = useFetch(getCatalog);

onMounted(() => {
  void local.run();
  void catalog.run();
});

const catalogItems = computed(() => catalog.data.value?.items ?? []);
const catalogMeta = computed(() => catalog.data.value ?? null);
const catalogByRepo = computed(() => {
  const map = new Map<string, CatalogItem>();
  for (const item of catalogItems.value) {
    if (item.repositoryId) map.set(item.repositoryId, item);
  }
  return map;
});
const importedRepos = computed(() => {
  const set = new Set<string>();
  for (const t of local.data.value ?? []) {
    if (t.sourceRepo) set.add(t.sourceRepo);
  }
  return set;
});
/** 个人下载包没有仓库地址，靠模板中心编号（receipt.templateId）与清单对齐。 */
const importedNumbers = computed(() => {
  const set = new Set<number>();
  for (const t of local.data.value ?? []) {
    if (typeof t.templateId === 'number') set.add(t.templateId);
  }
  return set;
});
function isImported(item: { repositoryId?: string | null; templateId?: number | null }): boolean {
  if (item.repositoryId && importedRepos.value.has(item.repositoryId)) return true;
  return typeof item.templateId === 'number' && importedNumbers.value.has(item.templateId);
}

/* ---------- 导入 ---------- */
const fileInput = ref<HTMLInputElement | null>(null);
const importing = ref(false);
const progress = ref(0);
const lastImported = ref<string | null>(null);

function pickFile() {
  if (importing.value) return;
  fileInput.value?.click();
}

async function onFilePicked(event: Event) {
  const el = event.target as HTMLInputElement;
  const file = el.files?.[0] ?? null;
  el.value = '';
  if (!file) return;
  if (!/\.(motion|zip)$/i.test(file.name)) {
    message.warning('请选择 .motion 模板包（本质是 zip 容器）');
    return;
  }
  importing.value = true;
  progress.value = 0;
  try {
    const result = await importTemplate(file, (p) => {
      progress.value = p;
    });
    progress.value = 100;
    lastImported.value = result.name;
    const integrity = result.integrity === 'verified'
      ? `完整性校验通过（${result.verifiedFiles} 个文件）`
      : '包内未声明完整性清单';
    message.success(`已导入「${result.name}」${result.version ?? ''}：${result.fileCount} 个文件，${integrity}`);
    await local.run();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    importing.value = false;
    setTimeout(() => {
      progress.value = 0;
    }, 600);
  }
}

/* ---------- 模板中心筛选 ---------- */
const query = ref('');
const orientation = ref<'all' | 'landscape' | 'portrait'>('all');
const visibleCount = ref(24);

const orientationOptions: Array<{ label: string; value: 'all' | 'landscape' | 'portrait' }> = [
  { label: '全部', value: 'all' },
  { label: '横屏', value: 'landscape' },
  { label: '竖屏', value: 'portrait' },
];

const filteredCatalog = computed(() => {
  const q = query.value.trim().toLowerCase();
  return catalogItems.value.filter((item) => {
    if (orientation.value !== 'all' && item.orientation !== orientation.value) return false;
    if (!q) return true;
    return [
      item.name,
      item.nameEn,
      item.summary,
      String(item.templateId),
      item.repositoryId,
    ]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });
});

const visibleCatalog = computed(() => filteredCatalog.value.slice(0, visibleCount.value));
const hasMore = computed(() => filteredCatalog.value.length > visibleCount.value);

function resetVisible() {
  visibleCount.value = 24;
}

watch(query, resetVisible);

function setOrientation(value: 'all' | 'landscape' | 'portrait') {
  orientation.value = value;
  resetVisible();
}

async function refreshCatalog() {
  await catalog.run();
  if (catalog.data.value?.error) {
    message.warning('清单拉取失败，已使用本地缓存');
  }
}

/* ---------- 本地模板详情 ---------- */
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

function originTone(origin: string): 'neutral' | 'warning' | 'success' {
  if (origin === 'cache') return 'warning';
  if (origin === 'builtin') return 'success';
  return 'neutral';
}
function originLabel(origin: string): string {
  if (origin === 'local') return '已导入';
  if (origin === 'builtin') return '内置';
  if (origin === 'cache') return '缓存';
  return origin;
}
function networkTag(network: boolean | null) {
  if (network === true) return { tone: 'info' as const, text: '需联网' };
  if (network === false) return { tone: 'neutral' as const, text: '离线' };
  return { tone: 'neutral' as const, text: '未知' };
}

function coverOf(t: TemplateSummary): string | null {
  const byRepo = t.sourceRepo ? catalogByRepo.value.get(t.sourceRepo)?.poster : null;
  if (byRepo) return byRepo;
  if (typeof t.templateId === 'number') {
    return catalogItems.value.find((i) => i.templateId === t.templateId)?.poster ?? null;
  }
  return null;
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

/* ---------- 文件树 ---------- */
interface TreeNode {
  key: string;
  label: string;
  type: 'dir' | 'file';
  children?: TreeNode[];
  [key: string]: unknown;
}

const HIDDEN_FILES = new Set(['.DS_Store', 'Thumbs.db', '.import-meta.json']);

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
  const wh = o.width && o.height ? `${o.width}×${o.height}` : '';
  const fps = (o.fps as { num?: number; den?: number } | undefined)?.num
    ? `${(o.fps as { num: number; den?: number }).num}/${(o.fps as { den?: number }).den ?? 1} fps`
    : '';
  return [wh, fps].filter(Boolean).join(' · ') || '—';
});

/* ---------- 模板中心详情 ---------- */
const catShow = ref(false);
const catItem = ref<CatalogItem | null>(null);

function openCatalog(item: CatalogItem) {
  catItem.value = item;
  catShow.value = true;
}

async function copyNumber(id: number) {
  try {
    await navigator.clipboard.writeText(String(id));
    message.success(`已复制模板编号 ${id}`);
  } catch {
    message.warning(`模板编号：${id}`);
  }
}

const catBadges = computed(() => {
  const item = catItem.value;
  if (!item) return [] as string[];
  return [
    `#${item.templateId}`,
    item.ratio ?? '',
    item.version ?? '',
  ].filter(Boolean) as string[];
});

const catSummary = computed(() => {
  const item = catItem.value;
  if (!item) return '';
  return item.summary || item.summaryEn || '';
});
</script>

<template>
  <div class="templates">
    <!-- 顶部：导入入口 -->
    <section class="hero">
      <div class="hero__text">
        <div class="hero__title">模板库</div>
        <div class="hero__desc">
          从官网下载 .motion 包后在这里导入；导入时校验包结构、运行时入口与逐文件 sha256，按版本落到 studio/templates，旧版本不覆盖。
        </div>
      </div>
      <div class="hero__actions">
        <input
          ref="fileInput"
          type="file"
          accept=".motion,.zip,application/zip"
          class="hidden-input"
          @change="onFilePicked"
        />
        <n-button type="primary" :loading="importing" @click="pickFile">
          <template #icon>
            <n-icon :size="14"><CloudUploadOutline /></n-icon>
          </template>
          导入 .motion
        </n-button>
        <n-button tag="a" :href="OFFICIAL_SITE" target="_blank" rel="noopener noreferrer" quaternary>
          <template #icon>
            <n-icon :size="14"><OpenOutline /></n-icon>
          </template>
          前往官网
        </n-button>
      </div>
    </section>

    <div v-if="importing" class="progress-row">
      <n-progress type="line" :percentage="progress" :height="6" :show-indicator="false" processing />
      <span class="progress-row__text">{{ progress }}% · 上传后会校验完整性再落盘</span>
    </div>

    <!-- 我的模板 -->
    <section class="block">
      <header class="section-head">
        <h2 class="section-head__title">我的模板</h2>
        <span v-if="local.data.value" class="section-head__meta">共 {{ local.data.value.length }} 个</span>
      </header>

      <EmptyState v-if="local.error.value" tone="danger" :description="local.error.value" tip="模板清单加载失败">
        <template #action>
          <n-button type="primary" @click="local.run">重试</n-button>
        </template>
      </EmptyState>

      <div v-else-if="local.loading.value" class="local-grid">
        <div v-for="i in 3" :key="i" class="local-card">
          <SkeletonBlock :rows="3" />
        </div>
      </div>

      <EmptyState
        v-else-if="!local.data.value?.length"
        description="还没有本地模板"
        tip="先在官网下载 .motion 包，再点右上角导入"
      />

      <div v-else class="local-grid">
        <button
          v-for="t in local.data.value"
          :key="t.id"
          type="button"
          class="local-card"
          @click="open(t.id)"
        >
          <div class="local-card__cover">
            <img
              v-if="coverOf(t)"
              :src="coverOf(t) ?? ''"
              :alt="t.name"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <div v-else class="local-card__cover--fallback">{{ t.name.slice(0, 1) }}</div>
            <div class="local-card__badges">
              <StatusTag v-if="t.integrity === 'verified'" status="success" text="已校验" />
              <StatusTag v-if="t.paidCloud" status="warning" text="需官方积分" />
            </div>
          </div>

          <div class="local-card__body">
            <div class="local-card__name">{{ t.name }}</div>
            <div class="local-card__sub">
              <span class="mono">{{ t.version || '—' }}</span>
              <span v-if="t.fileCount">{{ t.fileCount }} 个文件</span>
            </div>
            <div class="mono local-card__path">{{ t.localPath }}</div>
            <div class="local-card__meta">
              <span class="local-card__label">入口</span>
              <span class="mono local-card__value">{{ t.runtime.entry || '—' }}</span>
            </div>
            <div class="local-card__meta">
              <span class="local-card__label">Profile</span>
              <span class="mono local-card__value">{{ t.runtime.profile || '—' }}</span>
            </div>
          </div>
        </button>
      </div>
    </section>

    <!-- 模板中心 -->
    <section class="block">
      <header class="section-head">
        <h2 class="section-head__title">模板中心</h2>
        <span v-if="catalogMeta" class="section-head__meta">
          {{ catalogMeta.items.length }} 条公开清单<template v-if="catalogMeta.fetchedAt"> · 更新于 {{ new Date(catalogMeta.fetchedAt).toLocaleString('zh-CN') }}</template>
        </span>
        <n-button size="small" quaternary :loading="catalog.loading.value" @click="refreshCatalog">
          <template #icon>
            <n-icon :size="14"><RefreshOutline /></n-icon>
          </template>
          刷新
        </n-button>
      </header>

      <div class="toolbar">
        <n-input
          v-model:value="query"
          placeholder="搜索模板名称、简介或编号"
          clearable
        >
          <template #prefix>
            <n-icon :size="16"><SearchOutline /></n-icon>
          </template>
        </n-input>
        <div class="toolbar__seg">
          <button
            v-for="opt in orientationOptions"
            :key="opt.value"
            type="button"
            class="seg-btn"
            :class="{ 'seg-btn--active': orientation === opt.value }"
            @click="setOrientation(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div v-if="catalogMeta?.error" class="catalog-warn">
        清单拉取失败（{{ catalogMeta.error }}），当前显示本地缓存；可点刷新重试。
      </div>

      <EmptyState v-if="catalog.error.value" tone="danger" :description="catalog.error.value" tip="模板中心清单加载失败">
        <template #action>
          <n-button type="primary" @click="refreshCatalog">重试</n-button>
        </template>
      </EmptyState>

      <div v-else-if="catalog.loading.value" class="cat-grid">
        <div v-for="i in 6" :key="i" class="cat-card cat-card--skeleton">
          <SkeletonBlock :rows="3" />
        </div>
      </div>

      <EmptyState
        v-else-if="!filteredCatalog.length"
        description="没有匹配的模板"
        tip="换个关键词或切回全部画幅"
      />

      <template v-else>
        <div class="cat-grid">
          <button
            v-for="item in visibleCatalog"
            :key="item.templateId"
            type="button"
            class="cat-card"
            @click="openCatalog(item)"
          >
            <div class="cat-card__cover" :class="{ 'cat-card__cover--portrait': item.orientation === 'portrait' }">
              <img
                v-if="item.poster"
                :src="item.poster"
                :alt="item.name"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
              <div v-else class="cat-card__cover--fallback">{{ item.name.slice(0, 1) }}</div>
              <span class="cat-card__ratio">{{ item.ratio || (item.orientation === 'portrait' ? '9:16' : '16:9') }}</span>
              <span v-if="item.demo" class="cat-card__play">
                <n-icon :size="18"><PlayCircleOutline /></n-icon>
              </span>
            </div>

            <div class="cat-card__body">
              <div class="cat-card__head">
                <span class="cat-card__name">{{ item.name }}</span>
                <StatusTag
                  v-if="isImported(item)"
                  status="success"
                  text="已导入"
                />
              </div>
              <p class="cat-card__summary">{{ item.summary || item.summaryEn || '—' }}</p>
              <div class="cat-card__foot">
                <span class="mono cat-card__id">#{{ item.templateId }}</span>
                <span class="mono cat-card__ver">{{ item.version || '—' }}</span>
              </div>
            </div>
          </button>
        </div>

        <div class="load-more">
          <n-button v-if="hasMore" quaternary @click="visibleCount += 24">
            加载更多（剩余 {{ filteredCatalog.length - visibleCatalog.length }}）
          </n-button>
          <span v-else class="load-more__end">已显示全部 {{ filteredCatalog.length }} 条</span>
        </div>
      </template>
    </section>

    <!-- 本地模板详情抽屉 -->
    <n-drawer v-model:show="show" :width="'min(560px, 92vw)'">
      <n-drawer-content closable>
        <template #header>
          <div class="drawer-header">
            <span class="drawer-header__title">{{ detail?.name ?? '模板详情' }}</span>
            <n-button v-if="redirectUrl" tag="a" :href="redirectUrl" target="_blank" rel="noopener noreferrer" size="small" quaternary>
              <template #icon>
                <n-icon :size="14"><OpenOutline /></n-icon>
              </template>
              源码
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

          <section v-if="detail.importedAt" class="block">
            <h3 class="block__title">包校验</h3>
            <div class="row">
              <span class="row__label">完整性</span>
              <StatusTag
                :status="detail.integrity === 'verified' ? 'success' : 'warning'"
                :text="detail.integrity === 'verified' ? '逐文件 sha256 通过' : '包内未声明'"
              />
            </div>
            <div class="row row--column">
              <span class="row__label">包 sha256</span>
              <PathCopy :path="detail.packageSha256 || '—'" />
            </div>
            <div class="row">
              <span class="row__label">导入时间</span>
              <span class="row__value">{{ new Date(detail.importedAt).toLocaleString('zh-CN') }}</span>
            </div>
            <div class="row">
              <span class="row__label">文件数</span>
              <span class="row__value">{{ detail.fileCount ?? '—' }}</span>
            </div>
            <div v-if="detail.packageProfile" class="row">
              <span class="row__label">包规格</span>
              <span class="row__value mono">{{ detail.packageProfile }}<template v-if="detail.specVersion"> · {{ detail.specVersion }}</template></span>
            </div>
            <div v-if="detail.integritySource" class="row">
              <span class="row__label">校验清单</span>
              <span class="row__value mono">{{ detail.integritySource }}</span>
            </div>
            <div v-if="detail.templateId" class="row">
              <span class="row__label">模板编号</span>
              <span class="row__value mono">{{ detail.templateId }}</span>
            </div>
            <div v-if="detail.contentProtection" class="row">
              <span class="row__label">内容封装</span>
              <StatusTag
                :status="detail.contentProtection === 'protected' ? 'warning' : 'success'"
                :text="detail.contentProtection === 'protected' ? '加密封装，需随包入口运行' : detail.contentProtection"
              />
            </div>
            <n-alert v-if="detail.hasPersonalKey" type="warning" :bordered="false" class="block__note">
              这个包夹带了个人调用标识（personal/motiongit.key.json），只留在本机，不要提交、截图或转发给他人。
            </n-alert>
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
              <span class="row__label">计费依赖</span>
              <StatusTag v-if="detail.paidCloud" status="warning" text="官方云端 · 消耗积分" />
              <StatusTag v-else status="success" text="不依赖官方云端" />
            </div>
            <div v-if="detail.cloudOrigin" class="row row--column">
              <span class="row__label">官方服务</span>
              <PathCopy :path="detail.cloudOrigin" />
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
            <EmptyState v-if="!detail.parameters.fields.length" description="未声明参数 schema" />
            <div v-else class="param-list">
              <div v-for="f in detail.parameters.fields" :key="f.name" class="param-item">
                <div class="param-item__head">
                  <span class="mono param-item__name">{{ f.name }}</span>
                  <StatusTag :status="f.required ? 'warning' : 'neutral'" :text="f.required ? '必填' : '可选'" />
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
              <PathCopy :path="detail.license.file || (detail.layout === 'personal' ? '个人下载包不随附许可文件' : '—')" />
            </div>
            <div class="row">
              <span class="row__label">状态</span>
              <StatusTag
                :status="detail.license.present ? 'success' : detail.layout === 'personal' ? 'neutral' : 'danger'"
                :text="detail.license.present ? '已包含' : detail.layout === 'personal' ? '官网标注 MIT' : '缺失'"
              />
            </div>
          </section>

          <section class="block">
            <h3 class="block__title">文件树</h3>
            <n-tree :data="treeData" :render-prefix="renderPrefix" default-expand-all :selectable="false" />
          </section>

          <div class="drawer-cta">
            <n-button type="primary" size="large" block @click="useTemplate">用这个模板创作</n-button>
          </div>
        </div>
      </n-drawer-content>
    </n-drawer>

    <!-- 模板中心条目抽屉 -->
    <n-drawer v-model:show="catShow" :width="'min(760px, 94vw)'">
      <n-drawer-content closable>
        <template #header>
          <div class="drawer-header">
            <span class="drawer-header__title">{{ catItem?.name ?? '模板详情' }}</span>
            <n-button
              v-if="catItem?.website"
              tag="a"
              :href="catItem.website"
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              quaternary
            >
              <template #icon>
                <n-icon :size="14"><OpenOutline /></n-icon>
              </template>
              官网
            </n-button>
          </div>
        </template>

        <div v-if="catItem" class="cat-detail">
          <div v-if="catItem.demo" class="cat-detail__player">
            <video
              :src="catItem.demo"
              :poster="catItem.poster ?? undefined"
              controls
              preload="none"
              playsinline
            />
          </div>

          <div class="cat-detail__badges">
            <StatusTag
              v-for="badge in catBadges"
              :key="badge"
              status="neutral"
              :text="badge"
            />
            <StatusTag
              v-if="isImported(catItem)"
              status="success"
              text="已导入"
            />
          </div>

          <p class="cat-detail__summary">{{ catSummary || '暂无简介' }}</p>

          <div class="cat-detail__meta">
            <div class="row">
              <span class="row__label">编号</span>
              <span class="mono row__value">#{{ catItem.templateId }}</span>
              <n-button size="tiny" quaternary @click="copyNumber(catItem.templateId)">
                <template #icon>
                  <n-icon :size="13"><CopyOutline /></n-icon>
                </template>
                复制
              </n-button>
            </div>
            <div class="row">
              <span class="row__label">画幅</span>
              <span class="row__value">
                {{ catItem.orientation === 'portrait' ? '竖屏' : '横屏' }}
                · {{ catItem.ratio || '—' }}
                <template v-if="catItem.width && catItem.height"> · {{ catItem.width }}×{{ catItem.height }}</template>
                <template v-if="catItem.fps"> · {{ catItem.fps }} fps</template>
              </span>
            </div>
            <div class="row">
              <span class="row__label">版本</span>
              <span class="mono row__value">{{ catItem.version || '—' }}</span>
            </div>
            <div class="row">
              <span class="row__label">下载</span>
              <span class="row__value">
                {{ catItem.downloadType === 'direct-package' ? '公开直链' : '官网登录后获取' }}
              </span>
            </div>
          </div>

          <section v-if="catItem.materials" class="cat-detail__section">
            <h3 class="block__title">需要准备的素材</h3>
            <p class="cat-detail__text">{{ catItem.materials }}</p>
          </section>

          <section class="cat-detail__section">
            <h3 class="block__title">怎么用</h3>
            <ol class="cat-detail__steps">
              <li>点右侧按钮去官网，登录后下载对应版本的 .motion 包（保持原包，内含个人调用标识）。</li>
              <li>回到本页点「导入 .motion」，选择刚下载的文件；这里会校验结构、入口与逐文件 sha256。</li>
              <li>导入后出现在「我的模板」，可查看参数 schema、依赖锁与文件树，再按包内指南制作。</li>
            </ol>
          </section>

          <div class="cat-detail__actions">
            <n-button
              v-if="catItem.website"
              tag="a"
              :href="catItem.website"
              target="_blank"
              rel="noopener noreferrer"
              type="primary"
            >
              <template #icon>
                <n-icon :size="14"><DownloadOutline /></n-icon>
              </template>
              去官网下载
            </n-button>
            <n-button v-if="catItem.repository" tag="a" :href="catItem.repository" target="_blank" rel="noopener noreferrer" quaternary>
              源码仓
            </n-button>
            <n-button quaternary @click="pickFile">导入本地包</n-button>
          </div>
        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style scoped>
.templates {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding: 18px 22px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.hero__text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  max-width: 720px;
}

.hero__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.hero__desc {
  font-size: 12px;
  line-height: 20px;
  color: var(--color-text-secondary);
}

.hero__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.hidden-input {
  display: none;
}

.progress-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-row__text {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.block {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.section-head__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.section-head__meta {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-right: auto;
}

.local-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.local-card {
  display: flex;
  flex-direction: column;
  text-align: left;
  padding: 0;
  overflow: hidden;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: border-color var(--transition), transform var(--transition);
}

.local-card:hover {
  border-color: var(--color-brand);
  transform: translateY(-1px);
}

.local-card__cover {
  position: relative;
  height: 140px;
  background: var(--color-divider);
  overflow: hidden;
}

.local-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.local-card__cover--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 34px;
  font-weight: 700;
  color: var(--color-brand);
  background: var(--color-brand-soft);
}

.local-card__badges {
  flex-wrap: wrap;
  justify-content: flex-end;
  position: absolute;
  left: 10px;
  top: 10px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.local-card__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px 16px;
}

.local-card__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.local-card__sub {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.local-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  min-width: 0;
}

.local-card__path {
  margin-top: -4px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-card__label {
  flex: none;
  width: 48px;
  color: var(--color-text-tertiary);
}

.local-card__value {
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar :deep(.n-input) {
  flex: 1 1 260px;
  min-width: 220px;
  max-width: 420px;
}

.toolbar__seg {
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.seg-btn {
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background var(--transition), color var(--transition);
}

.seg-btn--active {
  background: var(--color-brand-soft);
  color: var(--color-brand);
  font-weight: 600;
}

.catalog-warn {
  padding: 10px 14px;
  font-size: 12px;
  color: var(--color-warning);
  background: var(--color-warning-soft);
  border-radius: var(--radius-control);
}

.cat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 16px;
}

.cat-card {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  text-align: left;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: border-color var(--transition), transform var(--transition);
}

.cat-card:hover {
  border-color: var(--color-brand);
  transform: translateY(-1px);
}

.cat-card--skeleton {
  padding: 16px;
  cursor: default;
}

.cat-card--skeleton:hover {
  transform: none;
}

.cat-card__cover {
  position: relative;
  height: 168px;
  background: var(--color-divider);
  overflow: hidden;
}

.cat-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 竖屏模板的封面按原比例居中显示，避免被横切成一条 */
.cat-card__cover--portrait img {
  object-fit: contain;
  background: #000;
}

.cat-card__cover--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 34px;
  font-weight: 700;
  color: var(--color-brand);
  background: var(--color-brand-soft);
}

.cat-card__ratio {
  position: absolute;
  right: 10px;
  top: 10px;
  padding: 1px 8px;
  font-size: 11px;
  border-radius: var(--radius-tag);
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--color-panel) 78%, transparent);
  backdrop-filter: blur(6px);
}

.cat-card__play {
  position: absolute;
  left: 10px;
  bottom: 10px;
  display: inline-flex;
  color: var(--color-panel);
  opacity: 0.9;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45));
}

.cat-card__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px 16px;
}

.cat-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.cat-card__name {
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
  color: var(--color-text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cat-card__summary {
  margin: 0;
  font-size: 12px;
  line-height: 19px;
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cat-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.cat-card__id {
  color: var(--color-brand);
}

.load-more {
  display: flex;
  justify-content: center;
  padding-top: 4px;
}

.load-more__end {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.drawer-cta {
  position: sticky;
  bottom: 0;
  padding: 14px 0 4px;
  background: var(--color-bg-elevated);
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

.drawer-loading {
  padding: 8px 0;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.block__title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.block__note {
  margin-top: 12px;
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

.cat-detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cat-detail__player {
  border-radius: var(--radius-card);
  overflow: hidden;
  background: #000;
  border: 1px solid var(--color-border);
}

.cat-detail__player video {
  display: block;
  width: 100%;
  max-height: 44vh;
  background: #000;
}

.cat-detail__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cat-detail__summary {
  margin: 0;
  font-size: 13px;
  line-height: 22px;
  color: var(--color-text-secondary);
}

.cat-detail__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.cat-detail__section {
  display: flex;
  flex-direction: column;
}

.cat-detail__text {
  margin: 0;
  font-size: 12px;
  line-height: 21px;
  color: var(--color-text-secondary);
}

.cat-detail__steps {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  line-height: 21px;
  color: var(--color-text-secondary);
}

.cat-detail__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 4px;
}
</style>
