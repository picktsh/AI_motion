<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NIcon, NButton, NCard, NEmpty, NSkeleton, NTag, NDrawer, NDrawerContent, NInput, NTree, NProgress, NAlert, NRadioGroup, NRadioButton, useMessage, type TreeOption } from 'naive-ui';
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
  FolderOpenOutline,
} from '@vicons/ionicons5';
import {
  listTemplates,
  getCatalog,
  importTemplate,
  getTemplateDetail,
  getTemplateRedirect,
} from '../api/templates';
import { useFetch } from '../composables/useFetch';
import { onDomain } from '../api/events';
import { useServerConfig } from '../composables/useServerConfig';
import PathCopy from '../components/data/PathCopy.vue';
import PromptCopyBlock from '../components/data/PromptCopyBlock.vue';
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
  router.push({ path: '/create', query: { template: id } });
}

const local = useFetch(listTemplates);
const catalog = useFetch(getCatalog);
const { backendContextLines, apiUrl } = useServerConfig();

let refreshTimer: number | undefined;
const offs: Array<() => void> = [];
onMounted(() => {
  void local.run();
  void catalog.run();
  offs.push(
    onDomain('template', () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void local.run(), 500);
    }),
  );
});
onUnmounted(() => {
  window.clearTimeout(refreshTimer);
  offs.forEach((off) => off());
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
/** 下载包没有仓库地址时，靠模板中心编号与清单对齐。 */
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

/** 模板一律来自官网下载；没有运行入口 = 包坏了，标灰引导重新下载。 */
function isBroken(t: TemplateSummary): boolean {
  return !t.runtime?.entry;
}

/* ---------- 导入 ---------- */
const fileInput = ref<HTMLInputElement | null>(null);
const importing = ref(false);
const progress = ref(0);

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
    message.success(`已导入「${result.name}」${result.version ?? ''}：${result.fileCount} 个文件`);
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
    return [item.name, item.nameEn, item.summary, String(item.templateId), item.repositoryId]
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

function networkTag(network: boolean | null) {
  if (network === true) return { type: 'info' as const, text: '需联网' };
  if (network === false) return { type: 'default' as const, text: '离线' };
  return { type: 'default' as const, text: '未知' };
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
    case 'string': return '文本';
    case 'number': return '数值';
    case 'boolean': return '开关';
    case 'array': return '数组';
    case 'object': return '对象';
    case 'const': return '常量';
    default: return '任意';
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

const templatePrompt = computed(() => {
  const d = detail.value;
  if (!d) return '';
  return [
    ...backendContextLines(),
    '',
    `我要基于模板「${d.name}」做一条片子。`,
    `模板 ID：${d.id} · 版本：${d.version || '—'}`,
    `模板本地目录："${d.localPath}"`,
    `- 先在快照 templates 里核对该模板的槽位摘要，再按参数 schema${d.parameters.file ? `（"${d.parameters.file}"）` : ''}准备输入：标题、口播文稿、素材绑定与配音偏好。`,
    `- 新建项目调 POST ${apiUrl('/projects')}，body 带 templateId（必填）、script（必填，口播文稿）、title、keywords、duration；后端自动建目录、写 "script.txt" 并登记台账，不要手工建目录。`,
    '- 入参文件落到新项目的 "input/" 目录，不要改动模板包本身。',
  ].join('\n');
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
  return [`#${item.templateId}`, item.ratio ?? '', item.version ?? ''].filter(Boolean) as string[];
});

const catSummary = computed(() => {
  const item = catItem.value;
  if (!item) return '';
  return item.summary || item.summaryEn || '';
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- 顶部：导入入口 -->
    <section class="card row-between gap-4 flex-wrap px-5 py-4">
      <div class="flex flex-col gap-1 min-w-0 max-w-180">
        <div class="text-xl font-semibold text-ink">模板库</div>
        <div class="text-xs leading-5 text-ink-2">
          模板都从官网下载 .motion 包后在这里导入；按版本落到 studio/templates，旧版本不覆盖。包有问题时卡片会标灰，重新下载导入即可。
        </div>
      </div>
      <div class="flex items-center gap-2 flex-none">
        <input ref="fileInput" type="file" accept=".motion,.zip,application/zip" class="hidden" @change="onFilePicked" />
        <n-button type="primary" :loading="importing" @click="pickFile">
          <template #icon>
            <n-icon :size="14"><CloudUploadOutline /></n-icon>
          </template>
          导入 .motion
        </n-button>
        <n-button tag="a" :href="OFFICIAL_SITE" target="_blank" rel="noopener noreferrer" secondary>
          <template #icon>
            <n-icon :size="14"><OpenOutline /></n-icon>
          </template>
          前往官网
        </n-button>
      </div>
    </section>

    <div v-if="importing" class="flex flex-col gap-1">
      <n-progress type="line" :percentage="progress" :height="6" :show-indicator="false" processing />
      <span class="text-xs text-ink-3">{{ progress }}% · 上传后会校验完整性再落盘</span>
    </div>

    <!-- 我的模板 -->
    <section class="flex flex-col gap-3">
      <header class="flex items-center gap-3 flex-wrap">
        <h2 class="m-0 text-lg font-semibold text-ink">我的模板</h2>
        <span v-if="local.data.value" class="text-xs text-ink-3 mr-auto">共 {{ local.data.value.length }} 个</span>
      </header>

      <NEmpty v-if="local.error.value" :description="local.error.value">
        <template #icon>
          <NIcon class="text-danger"><FolderOpenOutline /></NIcon>
        </template>
        <template #default>
          <div class="flex flex-col items-center gap-2">
            <p class="m-0 text-xs text-ink-3">模板清单加载失败</p>
            <NButton type="primary" @click="local.run">重试</NButton>
          </div>
        </template>
      </NEmpty>

      <div v-else-if="local.loading.value" class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        <div v-for="i in 3" :key="i" class="card p-4">
          <NSkeleton text :repeat="3" class="w-full" />
        </div>
      </div>

      <NEmpty
        v-else-if="!local.data.value?.length"
        description="还没有本地模板"
      >
        <template #default>
          <p class="m-0 text-xs text-ink-3">先在官网下载 .motion 包，再点右上角导入</p>
        </template>
      </NEmpty>

      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        <div
          v-for="t in local.data.value"
          :key="t.id"
          class="card flex flex-col text-left overflow-hidden cursor-pointer transition duration-150 hover:border-brand hover:-translate-y-px"
          :class="isBroken(t) ? 'opacity-60 saturate-50' : ''"
          @click="open(t.id)"
        >
            <div class="relative h-35 bg-divider overflow-hidden">
              <img
                v-if="coverOf(t)"
                :src="coverOf(t) ?? ''"
                :alt="t.name"
                loading="lazy"
                referrerpolicy="no-referrer"
                class="w-full h-full object-cover block"
              />
              <div v-else class="flex items-center justify-center h-full text-4xl font-bold text-brand bg-brand-soft">
                {{ t.name.slice(0, 1) }}
              </div>
              <div class="absolute left-2 top-2 flex gap-1 flex-wrap">
                <NTag v-if="isBroken(t)" type="error" size="small" :bordered="false" class="flex-none w-fit">需重新下载</NTag>
                <NTag v-else-if="t.paidCloud" type="warning" size="small" :bordered="false" class="flex-none w-fit">需官方积分</NTag>
                <NTag v-else type="success" size="small" :bordered="false" class="flex-none w-fit">本机渲染</NTag>
              </div>
            </div>

            <div class="flex flex-col gap-2 px-4 pt-3 pb-4">
              <div class="text-lg font-semibold text-ink line-clamp-2">{{ t.name }}</div>
              <div class="flex items-center gap-2 text-xs text-ink-3">
                <span class="font-mono">{{ t.version || '—' }}</span>
                <span v-if="t.fileCount">{{ t.fileCount }} 个文件</span>
              </div>
              <div class="font-mono text-xs text-ink-3 truncate">{{ t.localPath }}</div>
              <div class="flex items-center gap-2 text-xs min-w-0">
                <span class="flex-none w-12 text-ink-3">入口</span>
                <span class="font-mono text-ink-2 truncate">{{ t.runtime.entry || '缺失' }}</span>
              </div>
            </div>
        </div>
      </div>
    </section>

    <!-- 模板中心 -->
    <section class="flex flex-col gap-3">
      <header class="flex items-center gap-3 flex-wrap">
        <h2 class="m-0 text-lg font-semibold text-ink">模板中心</h2>
        <span v-if="catalogMeta" class="text-xs text-ink-3 mr-auto">
          {{ catalogMeta.items.length }} 条公开清单<template v-if="catalogMeta.fetchedAt"> · 更新于 {{ new Date(catalogMeta.fetchedAt).toLocaleString('zh-CN') }}</template>
        </span>
        <n-button  secondary :loading="catalog.loading.value" @click="refreshCatalog">
          <template #icon>
            <n-icon :size="14"><RefreshOutline /></n-icon>
          </template>
          刷新
        </n-button>
      </header>

      <div class="flex items-center gap-3 flex-wrap">
        <n-input v-model:value="query" placeholder="搜索模板名称、简介或编号" clearable class="flex-1 min-w-56 max-w-104">
          <template #prefix>
            <n-icon :size="16"><SearchOutline /></n-icon>
          </template>
        </n-input>
        <NRadioGroup :value="orientation" @update:value="setOrientation">
          <NRadioButton v-for="opt in orientationOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </NRadioButton>
        </NRadioGroup>
      </div>

      <div v-if="catalogMeta?.error" class="px-3 py-2 text-xs text-warning bg-warning-soft rounded-control">
        清单拉取失败（{{ catalogMeta.error }}），当前显示本地缓存；可点刷新重试。
      </div>

      <NEmpty v-if="catalog.error.value" :description="catalog.error.value">
        <template #icon>
          <NIcon class="text-danger"><FolderOpenOutline /></NIcon>
        </template>
        <template #default>
          <div class="flex flex-col items-center gap-2">
            <p class="m-0 text-xs text-ink-3">模板中心清单加载失败</p>
            <NButton type="primary" @click="refreshCatalog">重试</NButton>
          </div>
        </template>
      </NEmpty>

      <div v-else-if="catalog.loading.value" class="grid grid-cols-[repeat(auto-fill,minmax(288px,1fr))] gap-4">
        <div v-for="i in 6" :key="i" class="card p-4">
          <NSkeleton text :repeat="3" class="w-full" />
        </div>
      </div>

      <NEmpty v-else-if="!filteredCatalog.length" description="没有匹配的模板">
        <template #default>
          <p class="m-0 text-xs text-ink-3">换个关键词或切回全部画幅</p>
        </template>
      </NEmpty>

      <template v-else>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(288px,1fr))] gap-4">
          <div
            v-for="item in visibleCatalog"
            :key="item.templateId"
            class="card overflow-hidden text-left cursor-pointer transition duration-150 hover:border-brand hover:-translate-y-px"
            @click="openCatalog(item)"
          >
              <div class="relative h-42 bg-divider overflow-hidden">
                <img
                  v-if="item.poster"
                  :src="item.poster"
                  :alt="item.name"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  class="w-full h-full block"
                  :class="item.orientation === 'portrait' ? 'object-contain bg-black' : 'object-cover'"
                />
                <div v-else class="flex items-center justify-center h-full text-4xl font-bold text-brand bg-brand-soft">
                  {{ item.name.slice(0, 1) }}
                </div>
                <span class="absolute right-2 top-2 px-2 py-1 text-xs rounded-control text-ink bg-panel shadow-card">
                  {{ item.ratio || (item.orientation === 'portrait' ? '9:16' : '16:9') }}
                </span>
                <span v-if="item.demo" class="absolute left-2 bottom-2 inline-flex text-panel opacity-90 drop-shadow">
                  <n-icon :size="18"><PlayCircleOutline /></n-icon>
                </span>
              </div>

              <div class="flex flex-col gap-2 px-4 pt-3 pb-4 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <span class="text-sm font-semibold leading-5 text-ink line-clamp-2">{{ item.name }}</span>
                  <NTag v-if="isImported(item)" type="success" size="small" :bordered="false" class="flex-none w-fit">已导入</NTag>
                </div>
                <p class="m-0 text-xs leading-5 text-ink-2 line-clamp-3">{{ item.summary || item.summaryEn || '—' }}</p>
                <div class="row-between mt-auto text-xs text-ink-3">
                  <span class="font-mono text-brand">#{{ item.templateId }}</span>
                  <span class="font-mono">{{ item.version || '—' }}</span>
                </div>
              </div>
        </div>
      </div>

        <div class="flex justify-center pt-1">
          <NButton v-if="hasMore" secondary @click="visibleCount += 24">
            加载更多（剩余 {{ filteredCatalog.length - visibleCatalog.length }}）
          </NButton>
          <span v-else class="text-xs text-ink-3">已显示全部 {{ filteredCatalog.length }} 条</span>
        </div>
      </template>
    </section>

    <!-- 本地模板详情抽屉 -->
    <n-drawer v-model:show="show" :width="'min(560px, 92vw)'">
      <n-drawer-content closable>
        <template #header>
          <div class="row-between gap-3">
            <span class="text-lg font-semibold text-ink">{{ detail?.name ?? '模板详情' }}</span>
            <NButton v-if="redirectUrl" tag="a" :href="redirectUrl" target="_blank" rel="noopener noreferrer" secondary>
              <template #icon>
                <n-icon :size="14"><OpenOutline /></n-icon>
              </template>
              源码
            </NButton>
          </div>
        </template>

        <div v-if="detailLoading" class="py-2">
          <NSkeleton text :repeat="5" class="w-full" />
        </div>
        <NEmpty v-else-if="detailError" :description="detailError">
          <template #icon>
            <NIcon class="text-danger"><FolderOpenOutline /></NIcon>
          </template>
        </NEmpty>
        <div v-else-if="detail" class="flex flex-col gap-6">
          <n-alert v-if="!detail.runtime.entry" type="warning" :bordered="false" title="这个包缺少运行入口">
            <div class="flex flex-col gap-2">
              <span>包结构不完整或版本不匹配，无法用于创作。请到官网重新下载对应版本的 .motion 包，再回这里导入；导入按版本落盘，旧目录不用管。</span>
              <n-button tag="a" :href="redirectUrl ?? OFFICIAL_SITE" target="_blank" rel="noopener noreferrer" type="primary" class="self-start">
                去官网重新下载
              </n-button>
            </div>
          </n-alert>

          <section class="flex flex-col gap-3">
            <h3 class="m-0 text-xs font-semibold text-ink-2">身份</h3>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">ID</span>
              <span class="font-mono text-ink min-w-0 truncate">{{ detail.id }}</span>
            </div>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">版本</span>
              <span class="text-ink min-w-0 truncate">{{ detail.version || '—' }}</span>
            </div>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">来源</span>
              <span class="text-ink">官网下载导入</span>
            </div>
            <div class="flex flex-col items-start gap-1 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">路径</span>
              <PathCopy :path="detail.localPath" />
            </div>
          </section>

          <section v-if="detail.importedAt" class="flex flex-col gap-3">
            <h3 class="m-0 text-xs font-semibold text-ink-2">包信息</h3>
            <div class="flex flex-col items-start gap-1 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">包 sha256</span>
              <PathCopy :path="detail.packageSha256 || '—'" />
            </div>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">导入时间</span>
              <span class="text-ink min-w-0 truncate">{{ new Date(detail.importedAt).toLocaleString('zh-CN') }}</span>
            </div>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">文件数</span>
              <span class="text-ink">{{ detail.fileCount ?? '—' }}</span>
            </div>
            <div v-if="detail.templateId" class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">模板编号</span>
              <span class="font-mono text-ink">{{ detail.templateId }}</span>
            </div>
            <n-alert v-if="detail.hasPersonalKey" type="warning" :bordered="false">
              这个包夹带了个人调用标识（personal/motiongit.key.json），只留在本机，不要提交、截图或转发给他人。
            </n-alert>
          </section>

          <section class="flex flex-col gap-3">
            <h3 class="m-0 text-xs font-semibold text-ink-2">运行时</h3>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">入口</span>
              <span class="font-mono text-ink min-w-0 truncate">{{ detail.runtime.entry || '缺失' }}</span>
            </div>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">网络</span>
              <NTag :type="networkTag(detail.network).type" size="small" :bordered="false" class="flex-none w-fit">{{ networkTag(detail.network).text }}</NTag>
            </div>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">计费依赖</span>
              <NTag v-if="detail.paidCloud" type="warning" size="small" :bordered="false" class="flex-none w-fit">官方云端 · 消耗积分</NTag>
              <NTag v-else type="success" size="small" :bordered="false" class="flex-none w-fit">本机渲染 · 不消耗积分</NTag>
            </div>
            <div v-if="detail.cloudOrigin" class="flex flex-col items-start gap-1 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">官方服务</span>
              <PathCopy :path="detail.cloudOrigin" />
            </div>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">输出</span>
              <span class="text-ink">{{ outputText }}</span>
            </div>
          </section>

          <section class="flex flex-col gap-3">
            <h3 class="m-0 text-xs font-semibold text-ink-2">参数</h3>
            <div v-if="detail.parameters.file" class="flex flex-col items-start gap-1 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">Schema</span>
              <PathCopy :path="detail.parameters.file" />
            </div>
            <NEmpty v-if="!detail.parameters.fields.length" description="未声明参数 schema" />
            <div v-else class="flex flex-col gap-2">
              <div v-for="f in detail.parameters.fields" :key="f.name" class="flex flex-col gap-1 px-3 py-2 border border-border rounded-control">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-mono text-sm font-semibold text-ink">{{ f.name }}</span>
                  <NTag :type="f.required ? 'warning' : 'default'" size="small" :bordered="false" class="flex-none w-fit">{{ f.required ? '必填' : '可选' }}</NTag>
                  <NTag type="default" size="small" :bordered="false" class="flex-none w-fit">{{ typeLabel(f.type) }}</NTag>
                </div>
                <div v-if="fieldSummary(f).length" class="flex flex-wrap gap-3 text-xs text-ink-2">
                  <span v-for="bit in fieldSummary(f)" :key="bit">{{ bit }}</span>
                </div>
                <p v-if="f.description" class="m-0 text-xs text-ink-3">{{ f.description }}</p>
              </div>
            </div>
          </section>

          <section class="flex flex-col gap-3">
            <h3 class="m-0 text-xs font-semibold text-ink-2">许可</h3>
            <div class="flex flex-col items-start gap-1 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">许可文件</span>
              <PathCopy :path="detail.license.file || '—'" />
            </div>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">状态</span>
              <NTag :type="detail.license.present ? 'success' : 'default'" size="small" :bordered="false" class="flex-none w-fit">{{ detail.license.present ? '已包含' : '官网标注 MIT' }}</NTag>
            </div>
          </section>

          <section class="flex flex-col gap-3">
            <h3 class="m-0 text-xs font-semibold text-ink-2">文件树</h3>
            <n-tree :data="treeData" :render-prefix="renderPrefix" default-expand-all :selectable="false" />
          </section>

          <div class="flex flex-col gap-3 sticky bottom-0 pt-3 pb-1 bg-overlay">
            <PromptCopyBlock
              title="交给 AI 助手"
              hint="选好模板后，把这段提示词复制给外部 AI 工具；由它按模板参数准备输入并落到新项目目录。"
              :prompt="templatePrompt"
            />
            <n-button secondary block :disabled="!detail.runtime.entry" @click="useTemplate">
              仍要在面板建工程目录
            </n-button>
          </div>
        </div>
      </n-drawer-content>
    </n-drawer>

    <!-- 模板中心条目抽屉 -->
    <n-drawer v-model:show="catShow" :width="'min(760px, 94vw)'">
      <n-drawer-content closable>
        <template #header>
          <div class="row-between gap-3">
            <span class="text-lg font-semibold text-ink">{{ catItem?.name ?? '模板详情' }}</span>
            <NButton v-if="catItem?.website" tag="a" :href="catItem.website" target="_blank" rel="noopener noreferrer" secondary>
              <template #icon>
                <n-icon :size="14"><OpenOutline /></n-icon>
              </template>
              官网
            </NButton>
          </div>
        </template>

        <div v-if="catItem" class="flex flex-col gap-4">
          <div v-if="catItem.demo" class="rounded-card overflow-hidden bg-black border border-border">
            <video :src="catItem.demo" :poster="catItem.poster ?? undefined" controls preload="none" playsinline class="block w-full max-h-[44vh] bg-black" />
          </div>

          <div class="flex flex-wrap gap-2">
            <NTag v-for="badge in catBadges" :key="badge" type="default" size="small" :bordered="false" class="flex-none w-fit">{{ badge }}</NTag>
            <NTag v-if="isImported(catItem)" type="success" size="small" :bordered="false" class="flex-none w-fit">已导入</NTag>
          </div>

          <p class="m-0 text-sm leading-6 text-ink-2">{{ catSummary || '暂无简介' }}</p>

          <div class="flex flex-col gap-1 px-3 py-3 border border-border rounded-control">
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">编号</span>
              <span class="font-mono text-ink">#{{ catItem.templateId }}</span>
              <n-button size="tiny" secondary @click="copyNumber(catItem.templateId)">
                <template #icon>
                  <n-icon :size="12"><CopyOutline /></n-icon>
                </template>
                复制
              </n-button>
            </div>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">画幅</span>
              <span class="text-ink">
                {{ catItem.orientation === 'portrait' ? '竖屏' : '横屏' }} · {{ catItem.ratio || '—' }}
                <template v-if="catItem.width && catItem.height"> · {{ catItem.width }}×{{ catItem.height }}</template>
                <template v-if="catItem.fps"> · {{ catItem.fps }} fps</template>
              </span>
            </div>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">版本</span>
              <span class="font-mono text-ink">{{ catItem.version || '—' }}</span>
            </div>
            <div class="flex items-center gap-3 py-1 text-sm">
              <span class="flex-none w-18 text-ink-3 text-xs">下载</span>
              <span class="text-ink">{{ catItem.downloadType === 'direct-package' ? '公开直链' : '官网登录后获取' }}</span>
            </div>
          </div>

          <section v-if="catItem.materials" class="flex flex-col">
            <h3 class="m-0 mb-3 text-xs font-semibold text-ink-2">需要准备的素材</h3>
            <p class="m-0 text-xs leading-5 text-ink-2">{{ catItem.materials }}</p>
          </section>

          <section class="flex flex-col">
            <h3 class="m-0 mb-3 text-xs font-semibold text-ink-2">怎么用</h3>
            <ol class="m-0 pl-4 flex flex-col gap-2 text-xs leading-5 text-ink-2 list-decimal">
              <li>点下方按钮去官网，登录后下载对应版本的 .motion 包（保持原包，内含个人调用标识）。</li>
              <li>回到本页点「导入 .motion」，选择刚下载的文件；这里会校验结构、入口与逐文件 sha256。</li>
              <li>导入后出现在「我的模板」，再点「用这个模板创作」进入创作链路。</li>
            </ol>
          </section>

          <div class="flex items-center gap-2 flex-wrap pt-1">
            <n-button v-if="catItem.website" tag="a" :href="catItem.website" target="_blank" rel="noopener noreferrer" type="primary">
              <template #icon>
                <n-icon :size="14"><DownloadOutline /></n-icon>
              </template>
              去官网下载
            </n-button>
            <n-button v-if="catItem.repository" tag="a" :href="catItem.repository" target="_blank" rel="noopener noreferrer" secondary>
              源码仓
            </n-button>
            <n-button secondary @click="pickFile">导入本地包</n-button>
          </div>
        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>
