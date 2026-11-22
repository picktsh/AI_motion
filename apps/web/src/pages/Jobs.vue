<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, nextTick, watch } from 'vue';
import { NSelect, NInput, NButton, useMessage } from 'naive-ui';
import { listJobs, getJob, getJobLogs, submitJob, cancelJob } from '../api/jobs';
import SectionCard from '../components/data/SectionCard.vue';
import StatusTag, { type StatusTone } from '../components/data/StatusTag.vue';
import SkeletonBlock from '../components/data/SkeletonBlock.vue';
import EmptyState from '../components/data/EmptyState.vue';
import type { CommandName, JobStatus, JobSnapshot, JobLogLine } from '../shared/types';

type FieldKey = 'input' | 'instance' | 'out' | 'time';

interface ParamField {
  key: FieldKey;
  label: string;
  placeholder: string;
}

interface CommandMeta {
  value: CommandName;
  label: string;
  description: string;
  fields: ParamField[];
}

const COMMANDS: CommandMeta[] = [
  {
    value: 'plan',
    label: '计划校验',
    description: '校验输入并输出渲染计划，不写实例目录',
    fields: [{ key: 'input', label: '输入文件', placeholder: 'studio/videos/input/user.json' }],
  },
  {
    value: 'prepare',
    label: '准备实例',
    description: '复制核心、绑定素材并生成实例配置',
    fields: [
      { key: 'input', label: '输入文件', placeholder: 'studio/videos/input/user.json' },
      { key: 'instance', label: '实例目录', placeholder: 'studio/videos/instance' },
    ],
  },
  {
    value: 'preview',
    label: '预览单帧',
    description: '渲染指定时刻的单帧预览图',
    fields: [
      { key: 'instance', label: '实例目录', placeholder: 'studio/videos/instance' },
      { key: 'out', label: '产物路径', placeholder: 'studio/videos/preview.png' },
      { key: 'time', label: '时间（秒）', placeholder: '1' },
    ],
  },
  {
    value: 'render',
    label: '渲染成片',
    description: '逐帧编码并混流音频，输出无声/成片视频',
    fields: [
      { key: 'instance', label: '实例目录', placeholder: 'studio/videos/instance' },
      { key: 'out', label: '产物路径', placeholder: 'studio/videos/output.mp4' },
    ],
  },
  {
    value: 'tts:voice',
    label: '生成配音分段',
    description: 'edge-tts 合成配音，生成分段与词边界',
    fields: [],
  },
  {
    value: 'tts:samples',
    label: '生成试音样例',
    description: '合成多音色试音片段与样例清单',
    fields: [],
  },
];

const commandOptions = COMMANDS.map((c) => ({ label: c.label, value: c.value }));

const STATUS_TONE: Record<JobStatus, StatusTone> = {
  queued: 'warning',
  running: 'info',
  succeeded: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

const STATUS_TEXT: Record<JobStatus, string> = {
  queued: '排队中',
  running: '运行中',
  succeeded: '成功',
  failed: '失败',
  cancelled: '已取消',
};

/* 表单 */
const selected = ref<CommandName>('plan');
const form = reactive<Record<FieldKey, string>>({ input: '', instance: '', out: '', time: '' });
const submitting = ref(false);

const currentMeta = computed<CommandMeta>(
  () => COMMANDS.find((c) => c.value === selected.value) ?? COMMANDS[0],
);

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

async function submit(): Promise<void> {
  const params: Record<string, unknown> = {};
  for (const f of currentMeta.value.fields) {
    const v = form[f.key].trim();
    if (!v) continue;
    params[f.key] = f.key === 'time' ? Number(v) : v;
  }
  submitting.value = true;
  try {
    const job = await submitJob(selected.value, params);
    message.success(`任务 ${job.id} 已提交`);
    await refreshList();
    await select(job.id);
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    submitting.value = false;
  }
}

async function onCancel(): Promise<void> {
  if (!activeId.value) return;
  try {
    const job = await cancelJob(activeId.value);
    detail.value = job;
    message.info('已请求取消任务');
    await refreshList();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
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
</script>

<template>
  <div class="jobs">
    <SectionCard title="提交任务">
      <div class="jobs__form">
        <div class="jobs__field jobs__field--select">
          <label class="jobs__label">命令</label>
          <NSelect v-model:value="selected" :options="commandOptions" size="small" />
        </div>
        <div v-for="f in currentMeta.fields" :key="f.key" class="jobs__field">
          <label class="jobs__label">{{ f.label }}</label>
          <NInput v-model:value="form[f.key]" :placeholder="f.placeholder" size="small" />
        </div>
        <div class="jobs__action">
          <p class="jobs__desc">{{ currentMeta.description }}</p>
          <NButton type="primary" :loading="submitting" @click="submit">提交任务</NButton>
        </div>
      </div>
    </SectionCard>

    <div class="jobs__body">
      <aside class="jobs__list">
        <SectionCard title="任务列表">
          <EmptyState v-if="error" tone="danger" :description="error" tip="任务列表加载失败">
            <template #action>
              <n-button type="primary" size="small" @click="refreshList">重试</n-button>
            </template>
          </EmptyState>
          <SkeletonBlock v-else-if="loading" :rows="4" />
          <EmptyState v-else-if="!jobs.length" description="暂无任务，提交一条命令开始" />
          <ul v-else class="job-list">
            <li
              v-for="job in jobs"
              :key="job.id"
              class="job-list__item"
              :class="{ 'job-list__item--active': job.id === activeId }"
              @click="select(job.id)"
            >
              <div class="job-list__head">
                <span class="job-list__command">{{ job.command }}</span>
                <StatusTag :status="STATUS_TONE[job.status]" :text="STATUS_TEXT[job.status]" />
              </div>
              <div class="job-list__meta">
                <span>提交 {{ fmtTime(job.createdAt) }}</span>
                <span>耗时 {{ fmtDuration(job.startedAt, job.finishedAt) }}</span>
              </div>
            </li>
          </ul>
        </SectionCard>
      </aside>

      <section class="jobs__detail">
        <SectionCard title="任务详情">
          <EmptyState v-if="!detail" description="从左侧选择一条任务查看详情与日志" />
          <template v-else>
            <div class="detail__row">
              <span class="detail__label">状态</span>
              <StatusTag :status="STATUS_TONE[detail.status]" :text="STATUS_TEXT[detail.status]" />
              <NButton
                v-if="isActive(detail.status)"
                size="small"
                type="warning"
                class="detail__cancel"
                @click="onCancel"
              >
                取消任务
              </NButton>
            </div>
            <div class="detail__row">
              <span class="detail__label">任务 ID</span>
              <span class="mono">{{ detail.id }}</span>
            </div>
            <div class="detail__row">
              <span class="detail__label">参数</span>
              <span class="mono">{{ JSON.stringify(detail.params) }}</span>
            </div>
            <div class="detail__row">
              <span class="detail__label">时间</span>
              <span>
                {{ fmtTime(detail.startedAt) }} → {{ fmtTime(detail.finishedAt) }} · 耗时
                {{ fmtDuration(detail.startedAt, detail.finishedAt) }}
              </span>
            </div>
            <div v-if="detail.artifact" class="detail__row">
              <span class="detail__label">产物</span>
              <a class="detail__link" :href="detail.artifact.url" target="_blank" rel="noopener noreferrer">
                {{ detail.artifact.rel }}
              </a>
            </div>
            <div v-if="detail.error" class="detail__error">
              <span class="detail__label">错误</span>
              <p class="detail__error-text">{{ detail.error.message }}</p>
            </div>
            <div v-if="resultText" class="detail__result">
              <span class="detail__label">结果</span>
              <pre class="detail__pre">{{ resultText }}</pre>
            </div>

            <div class="detail__logs">
              <span class="detail__label">日志（{{ logs.length }}）</span>
              <div ref="logBox" class="detail__logbox">
                <div v-if="!logs.length" class="detail__log-empty">暂无日志</div>
                <div v-for="line in logs" :key="line.seq" class="log-line" :class="`log-line--${line.stream}`">
                  <span class="log-line__seq">{{ line.seq }}</span>
                  <span class="log-line__text">{{ line.text }}</span>
                </div>
              </div>
            </div>
          </template>
        </SectionCard>
      </section>
    </div>
  </div>
</template>

<style scoped>
.jobs {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.jobs__form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
}

.jobs__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 220px;
}

.jobs__field--select {
  width: 180px;
}

.jobs__label {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.jobs__action {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.jobs__desc {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
  max-width: 320px;
  text-align: right;
}

.jobs__body {
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: 16px;
  align-items: start;
}

.job-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.job-list__item {
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: background-color 0.15s, border-color 0.15s;
}

.job-list__item:hover {
  background: var(--color-neutral-soft);
}

.job-list__item--active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
}

.job-list__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.job-list__command {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-family: var(--font-mono, monospace);
}

.job-list__meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.detail__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.detail__label {
  flex: none;
  width: 64px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.detail__cancel {
  margin-left: auto;
}

.detail__link {
  color: var(--color-brand);
  text-decoration: none;
  word-break: break-all;
}

.detail__error {
  margin: 8px 0;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--color-danger) 28%, transparent);
  border-radius: var(--radius-control);
  background: var(--color-danger-soft);
}

.detail__error-text {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-danger);
  white-space: pre-wrap;
}

.detail__result {
  margin-top: 8px;
}

.detail__pre {
  margin: 6px 0 0;
  padding: 12px;
  border-radius: var(--radius-control);
  background: var(--color-neutral-soft);
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.detail__logs {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail__logbox {
  height: 260px;
  overflow-y: auto;
  padding: 10px 12px;
  border-radius: var(--radius-control);
  background: var(--color-neutral-soft);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail__log-empty {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.log-line {
  display: flex;
  gap: 10px;
  font-size: 12px;
  line-height: 1.5;
  font-family: var(--font-mono, monospace);
}

.log-line__seq {
  flex: none;
  width: 28px;
  color: var(--color-text-tertiary);
}

.log-line__text {
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--color-text-secondary);
}

.log-line--stderr .log-line__text {
  color: var(--color-danger);
}

.mono {
  font-family: var(--font-mono, monospace);
  word-break: break-all;
}

@media (max-width: 960px) {
  .jobs__body {
    grid-template-columns: 1fr;
  }
}
</style>
