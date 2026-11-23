<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from 'vue';
import { NButton, NCard, NEmpty, NIcon, NSkeleton, NTag, useMessage } from 'naive-ui';
import { FolderOpenOutline } from '@vicons/ionicons5';
import { listJobs, getJob, getJobLogs, cancelJob } from '../api/jobs';
import type { CommandName, JobStatus, JobSnapshot, JobLogLine } from '../shared/types';

const COMMAND_LABEL: Record<CommandName, string> = {
  plan: '计划校验',
  prepare: '准备实例',
  preview: '预览单帧',
  render: '渲染成片',
  'tts:voice': '生成配音分段',
  'tts:samples': '生成试音样例',
  'project:run': '项目生成',
  'project:voice': '项目配音',
};

type TagType = 'default' | 'info' | 'success' | 'warning' | 'error';

const STATUS_TONE: Record<JobStatus, TagType> = {
  queued: 'warning',
  running: 'info',
  succeeded: 'success',
  failed: 'error',
  cancelled: 'default',
};

const STATUS_TEXT: Record<JobStatus, string> = {
  queued: '排队中',
  running: '运行中',
  succeeded: '成功',
  failed: '失败',
  cancelled: '已取消',
};

/* 列表 */
const jobs = ref<JobSnapshot[]>([]);
const loading = ref(true);
const error = ref('');

/* 详情与日志 */
const activeId = ref<string | null>(null);
const detail = ref<JobSnapshot | null>(null);
const logs = ref<JobLogLine[]>([]);
const logOffset = ref(0);
const logBox = ref<HTMLElement | null>(null);

const message = useMessage();

function isActive(status: JobStatus): boolean {
  return status === 'queued' || status === 'running';
}

async function refreshList(): Promise<void> {
  const list = await listJobs();
  jobs.value = list;
  if (activeId.value) {
    const cur = list.find((j) => j.id === activeId.value);
    if (cur) detail.value = cur;
  }
}

async function loadLogs(id: string, offset: number): Promise<void> {
  const res = await getJobLogs(id, offset);
  logs.value.push(...res.lines);
  logOffset.value = res.nextOffset;
}

async function select(id: string): Promise<void> {
  activeId.value = id;
  logs.value = [];
  logOffset.value = 0;
  detail.value = null;
  try {
    detail.value = await getJob(id);
    await loadLogs(id, 0);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const bins = (e as { details?: { missingBins?: string[] } }).details?.missingBins;
  return Array.isArray(bins) && bins.length ? `${msg}：${bins.join('、')}` : msg;
}

async function onCancel(): Promise<void> {
  if (!activeId.value) return;
  try {
    const job = await cancelJob(activeId.value);
    detail.value = job;
    message.info('已请求取消任务');
    await refreshList();
  } catch (e) {
    message.error(describeError(e));
  }
}

/* 轮询：存在未结束任务时，每 2s 刷新列表并增量拉取选中任务日志 */
let timer: number | undefined;

function schedulePoll(): void {
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    if (!jobs.value.some((j) => isActive(j.status))) return;
    void (async () => {
      try {
        await refreshList();
        if (activeId.value && detail.value && isActive(detail.value.status)) {
          await loadLogs(activeId.value, logOffset.value);
        }
      } catch {
        /* 轮询失败静默，下次重试 */
      }
    })();
  }, 2000);
}

onMounted(async () => {
  loading.value = true;
  error.value = '';
  try {
    await refreshList();
    // 进来就选中最近一条任务，避免"任务页看不到任务"的错觉。
    if (jobs.value.length) await select(jobs.value[0].id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
    schedulePoll();
  }
});

onUnmounted(() => window.clearInterval(timer));

watch(logs, async () => {
  await nextTick();
  if (logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight;
});

/* 展示派生 */
const resultText = computed(() => {
  const r = detail.value?.result;
  if (r == null) return '';
  return typeof r === 'string' ? r : JSON.stringify(r, null, 2);
});

function fmtTime(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
}

function fmtDuration(start: number | null, end: number | null): string {
  if (!start || !end) return '—';
  const ms = end - start;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function itemClass(id: string): string {
  return id === activeId.value
    ? 'border-brand bg-brand-soft'
    : 'border-border hover:bg-neutral-soft';
}

function logTextClass(stream: string): string {
  return stream === 'stderr' ? 'text-danger' : 'text-ink-2';
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-4 items-start">
    <aside>
      <NCard title="任务列表">
        <NEmpty v-if="error" :description="error">
          <template #icon>
            <NIcon class="text-danger"><FolderOpenOutline /></NIcon>
          </template>
          <template #default>
            <div class="flex flex-col items-center gap-2">
              <p class="m-0 text-xs text-ink-3">任务列表加载失败</p>
              <NButton type="primary" size="small" @click="refreshList">重试</NButton>
            </div>
          </template>
        </NEmpty>
        <NSkeleton v-else-if="loading" text :repeat="4" class="w-full" />
        <NEmpty v-else-if="!jobs.length" description="暂无任务">
          <template #default>
            <p class="m-0 text-xs text-ink-3">在项目页点生成、或在配音页触发试音后，任务会出现在这里</p>
          </template>
        </NEmpty>
        <ul v-else class="list-none m-0 p-0 flex flex-col gap-2">
          <li
            v-for="job in jobs"
            :key="job.id"
            class="p-3 border rounded-control cursor-pointer flex flex-col gap-1 transition-colors duration-150"
            :class="itemClass(job.id)"
            @click="select(job.id)"
          >
            <div class="row-between">
              <span class="text-sm font-semibold text-ink">{{ COMMAND_LABEL[job.command] ?? job.command }}</span>
              <NTag :type="STATUS_TONE[job.status]" size="small" :bordered="false" class="flex-none w-fit">{{ STATUS_TEXT[job.status] }}</NTag>
            </div>
            <div class="flex gap-3 text-xs text-ink-3 num">
              <span>提交 {{ fmtTime(job.createdAt) }}</span>
              <span>耗时 {{ fmtDuration(job.startedAt, job.finishedAt) }}</span>
            </div>
          </li>
        </ul>
      </NCard>
    </aside>

    <section>
      <NCard title="任务详情">
        <NEmpty v-if="!detail" description="从左侧选择一条任务查看详情与日志" />
        <template v-else>
          <div class="flex items-center gap-3 py-1 text-sm text-ink-2">
            <span class="flex-none w-16 text-xs text-ink-3">状态</span>
            <NTag :type="STATUS_TONE[detail.status]" size="small" :bordered="false" class="flex-none w-fit">{{ STATUS_TEXT[detail.status] }}</NTag>
            <NButton v-if="isActive(detail.status)" size="small" type="warning" class="ml-auto" @click="onCancel">
              取消任务
            </NButton>
          </div>
          <div class="flex items-center gap-3 py-1 text-sm text-ink-2">
            <span class="flex-none w-16 text-xs text-ink-3">命令</span>
            <span class="font-mono break-all">{{ COMMAND_LABEL[detail.command] ?? detail.command }}</span>
          </div>
          <div class="flex items-center gap-3 py-1 text-sm text-ink-2">
            <span class="flex-none w-16 text-xs text-ink-3">任务 ID</span>
            <span class="font-mono break-all">{{ detail.id }}</span>
          </div>
          <div class="flex items-center gap-3 py-1 text-sm text-ink-2">
            <span class="flex-none w-16 text-xs text-ink-3">参数</span>
            <span class="font-mono break-all">{{ JSON.stringify(detail.params) }}</span>
          </div>
          <div class="flex items-center gap-3 py-1 text-sm text-ink-2">
            <span class="flex-none w-16 text-xs text-ink-3">时间</span>
            <span class="num">
              {{ fmtTime(detail.startedAt) }} → {{ fmtTime(detail.finishedAt) }} · 耗时
              {{ fmtDuration(detail.startedAt, detail.finishedAt) }}
            </span>
          </div>
          <div v-if="detail.artifact" class="flex items-center gap-3 py-1 text-sm text-ink-2">
            <span class="flex-none w-16 text-xs text-ink-3">产物</span>
            <a class="text-brand no-underline break-all" :href="detail.artifact.url" target="_blank" rel="noopener noreferrer">
              {{ detail.artifact.rel }}
            </a>
          </div>
          <div v-if="detail.error" class="my-2 px-3 py-2 border border-danger rounded-control bg-danger-soft">
            <span class="text-xs text-ink-3">错误</span>
            <p class="mt-1 mb-0 text-sm text-danger whitespace-pre-wrap">{{ detail.error.message }}</p>
          </div>
          <div v-if="resultText" class="mt-2">
            <span class="text-xs text-ink-3">结果</span>
            <pre class="mt-1 mb-0 p-3 rounded-control bg-neutral-soft text-xs leading-5 overflow-x-auto whitespace-pre-wrap break-all font-mono">{{ resultText }}</pre>
          </div>

          <div class="mt-4 flex flex-col gap-2">
            <span class="text-xs text-ink-3">日志（{{ logs.length }}）</span>
            <div ref="logBox" class="h-64 overflow-y-auto px-3 py-2 rounded-control bg-neutral-soft flex flex-col gap-1">
              <div v-if="!logs.length" class="text-xs text-ink-3">暂无日志</div>
              <div v-for="line in logs" :key="line.seq" class="flex gap-2 text-xs leading-5 font-mono">
                <span class="flex-none w-7 text-ink-3 num">{{ line.seq }}</span>
                <span class="whitespace-pre-wrap break-all" :class="logTextClass(line.stream)">{{ line.text }}</span>
              </div>
            </div>
          </div>
        </template>
      </NCard>
    </section>
  </div>
</template>
