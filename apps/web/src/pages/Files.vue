<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref } from 'vue';
import {
  NButton, NDataTable, NDrawer, NDrawerContent, NDropdown, NEmpty, NIcon, NInput,
  NModal, NSelect, NSpin, NTree, useMessage,
  type DataTableColumns, type TreeOption,
} from 'naive-ui';
import {
  FolderOutline, DocumentOutline, ImageOutline, FilmOutline, MusicalNotesOutline, FileTrayOutline,
} from '@vicons/ionicons5';
import {
  listTree, readText, createDir, createFile, renameEntry, moveEntry, removeEntry,
  type FileEntry, type DirListing, type TextFile,
} from '../api/files';
import { assetUrl } from '../api/client';
import { onDomain } from '../api/events';
import SamplePlayer from '../components/media/SamplePlayer.vue';

const message = useMessage();

const ROOTS = [
  { key: 'studio/projects', label: '项目' },
  { key: 'studio/templates', label: '模板' },
  { key: 'studio/tts', label: '配音' },
  { key: 'studio/public', label: '公共' },
  { key: 'studio/assets', label: '公共素材' },
  { key: 'studio/videos', label: '旧视频' },
];

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.mkv'];
const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'];
const TEXT_EXTS = ['.txt', '.md', '.json', '.js', '.mjs', '.ts', '.yaml', '.yml', '.csv', '.log', '.vtt'];

const loading = ref(true);
const busy = ref('');
const listing = ref<DirListing | null>(null);
const currentPath = ref('');
const treeData = ref<TreeOption[]>([]);
const expandedKeys = ref<string[]>(ROOTS.map((r) => r.key));
const selectedKey = ref<string>('');

const previewEntry = ref<FileEntry | null>(null);
const previewText = ref<TextFile | null>(null);
const drawerOpen = ref(false);

const renameState = ref({ show: false, entry: null as FileEntry | null, name: '' });
const moveState = ref({ show: false, entry: null as FileEntry | null, target: '' });
const moveOptions = ref<{ label: string; value: string }[]>([]);
const createState = ref({ show: false, mode: 'dir' as 'dir' | 'file', name: '' });
const deleteState = ref({ show: false, entry: null as FileEntry | null });

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

function formatSize(n: number): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function formatTime(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('zh-CN', { hour12: false });
}

function nodeOf(e: FileEntry): TreeOption {
  return { key: e.rel, label: e.name, children: [] };
}

function findNode(nodes: TreeOption[], key: string): TreeOption | null {
  for (const n of nodes) {
    if (n.key === key) return n;
    const child = n.children ? findNode(n.children as TreeOption[], key) : null;
    if (child) return child;
  }
  return null;
}

async function ensureChildren(key: string): Promise<void> {
  const node = findNode(treeData.value, key);
  if (!node || (node.children && node.children.length > 0)) return;
  try {
    const { items } = await listTree(key);
    node.children = items.filter((i) => i.type === 'dir').map(nodeOf);
  } catch {
    node.children = [];
  }
}

async function load(rel: string): Promise<void> {
  loading.value = true;
  try {
    listing.value = await listTree(rel);
    currentPath.value = rel;
    selectedKey.value = rel;
    if (!rel) {
      treeData.value = listing.value.items
        .filter((i) => i.type === 'dir')
        .map((i) => ({ key: i.rel, label: i.name, children: [] }));
    }
  } catch (e) {
    message.error(e instanceof Error ? e.message : '目录读取失败');
  } finally {
    loading.value = false;
  }
}

async function onExpand(keys: Array<string | number>): Promise<void> {
  const next = keys.map(String);
  const fresh = next.filter((k) => !expandedKeys.value.includes(k));
  expandedKeys.value = next;
  await Promise.all(fresh.map(ensureChildren));
}

function onSelect(keys: Array<string | number>): void {
  const key = keys[0] ? String(keys[0]) : '';
  if (!key) return;
  const entry = listing.value?.items.find((i) => i.rel === key);
  if (entry?.type === 'file') {
    void openPreview(entry);
  } else {
    void load(key);
  }
}

const breadcrumb = computed(() => {
  if (!currentPath.value) return [];
  const parts = currentPath.value.split('/');
  return parts.map((p, i) => ({ label: p, rel: parts.slice(0, i + 1).join('/') }));
});

type PreviewKind = 'image' | 'video' | 'audio' | 'text' | 'other';
const previewKind = computed<PreviewKind>(() => {
  const name = previewEntry.value?.name ?? '';
  const ext = extOf(name);
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  if (TEXT_EXTS.includes(ext)) return 'text';
  return 'other';
});

const previewUrl = computed(() => (previewEntry.value ? assetUrl(previewEntry.value.rel) : ''));

const prettyText = computed(() => {
  const t = previewText.value;
  if (!t) return '';
  if (t.isJson) {
    try {
      return JSON.stringify(JSON.parse(t.content), null, 2);
    } catch {
      return t.content;
    }
  }
  return t.content;
});

async function openPreview(entry: FileEntry): Promise<void> {
  previewEntry.value = entry;
  previewText.value = null;
  drawerOpen.value = true;
  if (previewKind.value === 'text') {
    try {
      previewText.value = await readText(entry.rel);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '文本读取失败');
    }
  }
}

function iconOf(entry: FileEntry) {
  if (entry.type === 'dir') return FolderOutline;
  const ext = extOf(entry.name);
  if (IMAGE_EXTS.includes(ext)) return ImageOutline;
  if (VIDEO_EXTS.includes(ext)) return FilmOutline;
  if (AUDIO_EXTS.includes(ext)) return MusicalNotesOutline;
  if (TEXT_EXTS.includes(ext)) return DocumentOutline;
  return FileTrayOutline;
}

const columns: DataTableColumns<FileEntry> = [
  {
    title: '名称',
    key: 'name',
    render: (entry) => {
      const Icon = iconOf(entry);
      const label = h(
        'span',
        {
          class: entry.type === 'dir' ? 'cursor-pointer text-ink' : 'text-ink-2',
          onClick: () => entry.type === 'dir' && void load(entry.rel),
        },
        entry.name,
      );
      return h('span', { class: 'flex items-center min-w-0' }, [
        h(NIcon, { size: 15, class: 'mr-2 flex-none' }, { default: () => h(Icon) }),
        label,
      ]);
    },
  },
  { title: '大小', key: 'size', width: 110, render: (e) => (e.type === 'dir' ? '—' : formatSize(e.size)) },
  { title: '修改时间', key: 'mtime', width: 200, render: (e) => formatTime(e.mtime) },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render: (entry) =>
      h(
        NDropdown,
        {
          trigger: 'click',
          options: actionOptions(entry),
          onSelect: (key: string) => onAction(key, entry),
        },
        {
          default: () => h(NButton, { size: 'tiny', secondary: true }, { default: () => '管理' }),
        },
      ),
  },
];

function actionOptions(entry: FileEntry) {
  const opts = [
    { label: '重命名', key: 'rename' },
    { label: '移动', key: 'move' },
    { label: '复制路径', key: 'copy' },
  ];
  if (entry.type === 'file') opts.unshift({ label: '预览', key: 'preview' });
  opts.push({ label: '删除', key: 'delete' });
  return opts;
}

async function onAction(key: string, entry: FileEntry): Promise<void> {
  switch (key) {
    case 'preview':
      await openPreview(entry);
      break;
    case 'rename':
      renameState.value = { show: true, entry, name: entry.name };
      break;
    case 'move':
      await openMove(entry);
      break;
    case 'copy':
      try {
        await navigator.clipboard.writeText(entry.rel);
        message.success('路径已复制');
      } catch {
        message.error('复制失败，请手动复制');
      }
      break;
    case 'delete':
      deleteState.value = { show: true, entry };
      break;
  }
}

async function openMove(entry: FileEntry): Promise<void> {
  moveState.value = { show: true, entry, target: currentPath.value };
  const collected: string[] = [];
  for (const root of ROOTS) {
    collected.push(...(await collectDirs(root.key, 0)));
  }
  moveOptions.value = [...new Set(collected)].map((d) => ({ label: d, value: d }));
}

async function collectDirs(root: string, depth: number): Promise<string[]> {
  if (depth > 3) return [];
  let items: FileEntry[] = [];
  try {
    const listing = await listTree(root);
    items = listing.items;
  } catch {
    return [];
  }
  const dirs = items.filter((i) => i.type === 'dir').map((i) => i.rel);
  const nested = await Promise.all(dirs.map((d) => collectDirs(d, depth + 1)));
  return [root, ...dirs, ...nested.flat()];
}

async function submitRename(): Promise<void> {
  const { entry, name } = renameState.value;
  if (!entry || !name.trim()) return;
  busy.value = 'rename';
  try {
    await renameEntry(entry.rel, name.trim());
    message.success('已重命名');
    renameState.value.show = false;
    await load(currentPath.value);
  } catch (e) {
    message.error(e instanceof Error ? e.message : '重命名失败');
  } finally {
    busy.value = '';
  }
}

async function submitMove(): Promise<void> {
  const { entry, target } = moveState.value;
  if (!entry || !target) return;
  busy.value = 'move';
  try {
    await moveEntry(entry.rel, target);
    message.success('已移动');
    moveState.value.show = false;
    await load(currentPath.value);
  } catch (e) {
    message.error(e instanceof Error ? e.message : '移动失败');
  } finally {
    busy.value = '';
  }
}

async function submitCreate(): Promise<void> {
  const { mode, name } = createState.value;
  if (!name.trim()) return;
  const rel = currentPath.value ? `${currentPath.value}/${name.trim()}` : name.trim();
  busy.value = 'create';
  try {
    if (mode === 'dir') await createDir(rel);
    else await createFile(rel);
    message.success(mode === 'dir' ? '目录已创建' : '文件已创建');
    createState.value.show = false;
    await load(currentPath.value);
  } catch (e) {
    message.error(e instanceof Error ? e.message : '创建失败');
  } finally {
    busy.value = '';
  }
}

async function submitDelete(): Promise<void> {
  const entry = deleteState.value.entry;
  if (!entry) return;
  busy.value = 'delete';
  try {
    await removeEntry(entry.rel);
    message.success('已删除');
    deleteState.value.show = false;
    await load(currentPath.value);
  } catch (e) {
    message.error(e instanceof Error ? e.message : '删除失败');
  } finally {
    busy.value = '';
  }
}

let refreshTimer: number | undefined;
const offs: Array<() => void> = [];

onMounted(async () => {
  await load('');
  const schedule = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => void load(currentPath.value), 500);
  };
  offs.push(
    onDomain('project', schedule),
    onDomain('artifact', schedule),
    onDomain('asset', schedule),
    onDomain('template', schedule),
  );
});

onUnmounted(() => {
  window.clearTimeout(refreshTimer);
  offs.forEach((off) => off());
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="min-w-0">
      <h2 class="page-title">文件</h2>
      <p class="page-desc mt-1">浏览工程目录树，预览图片、音视频与文本；删除、改名、移动等操作受白名单目录与引用核对保护。</p>
    </div>

    <div class="flex gap-3" style="height: 560px">
      <div class="card w-56 flex-none overflow-auto p-2">
        <NTree
          :data="treeData"
          :expanded-keys="expandedKeys"
          :selected-keys="[selectedKey]"
          :on-update:expanded-keys="onExpand"
          @update:selected-keys="onSelect"
          block-line
        />
      </div>
      <div class="card min-w-0 flex-1 flex flex-col gap-3 p-3">
          <div class="flex items-center gap-2 flex-wrap">
            <NButton size="tiny" secondary :disabled="!currentPath" @click="load(listing?.parent ?? '')">上级</NButton>
            <span class="text-xs text-ink-3 font-mono">
              <span v-if="!currentPath">studio/</span>
              <template v-for="(c, i) in breadcrumb" :key="c.rel">
                <span class="cursor-pointer hover:text-brand" @click="load(c.rel)">{{ c.label }}</span>
                <span v-if="i < breadcrumb.length - 1"> / </span>
              </template>
            </span>
            <div class="flex-1" />
            <NButton size="tiny" secondary @click="createState = { show: true, mode: 'dir', name: '' }">新建目录</NButton>
            <NButton size="tiny" secondary @click="createState = { show: true, mode: 'file', name: '' }">新建文件</NButton>
            <NButton size="tiny" secondary @click="load(currentPath)">刷新</NButton>
          </div>

          <NSpin :show="loading" class="flex-1">
            <NDataTable
              v-if="listing?.items.length"
              :columns="columns"
              :data="listing.items"
              :row-key="(row: FileEntry) => row.rel"
              :bordered="false"
              size="small"
              :scroll-x="720"
            />
            <NEmpty v-else description="空目录" class="py-16" />
          </NSpin>
      </div>
    </div>

    <NDrawer v-model:show="drawerOpen" :width="520" placement="right">
      <NDrawerContent :title="previewEntry?.name ?? '预览'" closable>
        <div class="flex flex-col gap-3">
          <img v-if="previewKind === 'image'" :src="previewUrl" class="w-full rounded-control" />
          <video v-else-if="previewKind === 'video'" :src="previewUrl" controls class="w-full rounded-control bg-black" />
          <SamplePlayer v-else-if="previewKind === 'audio'" :url="previewUrl" />
          <pre v-else-if="previewKind === 'text'" class="m-0 p-3 rounded-control bg-bg text-xs font-mono whitespace-pre-wrap break-all max-h-120 overflow-auto">{{ prettyText }}</pre>
          <NEmpty v-else description="该文件类型不支持面板预览" />
          <div class="text-xs text-ink-3 font-mono break-all">{{ previewEntry?.rel }}</div>
        </div>
      </NDrawerContent>
    </NDrawer>

    <NModal v-model:show="renameState.show" preset="card" title="重命名" class="max-w-120">
      <NInput v-model:value="renameState.name" placeholder="新文件名" :status="renameState.name.trim() ? undefined : 'error'" />
      <div class="mt-4 flex justify-end gap-2">
        <NButton secondary @click="renameState.show = false">取消</NButton>
        <NButton type="primary" :loading="busy === 'rename'" @click="submitRename">保存</NButton>
      </div>
    </NModal>

    <NModal v-model:show="moveState.show" preset="card" title="移动到目录" class="max-w-120">
      <NSelect v-model:value="moveState.target" :options="moveOptions" filterable placeholder="选择目标目录" />
      <div class="mt-4 flex justify-end gap-2">
        <NButton secondary @click="moveState.show = false">取消</NButton>
        <NButton type="primary" :loading="busy === 'move'" @click="submitMove">移动</NButton>
      </div>
    </NModal>

    <NModal v-model:show="createState.show" preset="card" :title="createState.mode === 'dir' ? '新建目录' : '新建文本文件'" class="max-w-120">
      <NInput v-model:value="createState.name" placeholder="名称（文本文件需带 .txt/.md/.json 等扩展名）" />
      <div class="mt-4 flex justify-end gap-2">
        <NButton secondary @click="createState.show = false">取消</NButton>
        <NButton type="primary" :loading="busy === 'create'" @click="submitCreate">创建</NButton>
      </div>
    </NModal>

    <NModal v-model:show="deleteState.show" preset="card" title="确认删除" class="max-w-120">
      <p class="m-0 text-sm text-ink-2">
        确定删除「{{ deleteState.entry?.name }}」吗？被项目素材登记引用的文件会被拦截；目录只能删除空目录。
      </p>
      <div class="mt-4 flex justify-end gap-2">
        <NButton secondary @click="deleteState.show = false">取消</NButton>
        <NButton type="error" :loading="busy === 'delete'" @click="submitDelete">删除</NButton>
      </div>
    </NModal>
  </div>
</template>
