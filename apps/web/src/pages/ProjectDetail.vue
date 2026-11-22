<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NSpin, NAlert, NTag, NCollapse, NCollapseItem } from 'naive-ui';
import {
  getProject,
  projectFiles,
  quoteProject,
  runProject,
  getProjectCredits,
  readProjectLog,
  type Project,
  type ProjectCredits,
  type ProjectFiles,
} from '../api/projects';
import SectionCard from '../components/data/SectionCard.vue';

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id ?? ''));

const project = ref<Project | null>(null);
const files = ref<ProjectFiles | null>(null);
const credits = ref<ProjectCredits | null>(null);
const loading = ref(true);
const busy = ref('');
const error = ref('');
const logText = ref('');
let autoQuoted = false;

const isCloud = computed(() => project.value?.runner === 'cloud');
const running = computed(() => project.value?.status === 'running');
const balance = computed(() =>
  Number(credits.value?.credits_remaining ?? credits.value?.account_balance?.available ?? 0),
);
const quoteTotal = computed(() => Number(project.value?.quote?.total ?? 0));
const insufficient = computed(() => isCloud.value && quoteTotal.value > 0 && balance.value < quoteTotal.value);

const friendlyError = computed(() => {
  const raw = error.value || project.value?.error || '';
  if (!raw) return '';
  if (raw.includes('insufficient_credits')) {
    return `官方账号积分不足：本次需要 ${quoteTotal.value}，余额 ${balance.value}。这不是本站收费，是模板包内官方 Key 调云端配音/编排的额度不够。`;
  }
  return raw;
});

const statusText = computed(() => {
  const map = { draft: '待报价', quoted: '已报价', running: '生成中', failed: '生成失败', done: '已成片' };
  return project.value ? map[project.value.status] : '';
});
const statusType = computed(() => {
  const map = { draft: 'default', quoted: 'info', running: 'info', failed: 'error', done: 'success' } as const;
  return project.value ? map[project.value.status] : 'default';
});

async function refresh() {
  loading.value = true;
  try {
    const [p, f, c] = await Promise.all([
      getProject(id.value),
      projectFiles(id.value),
      getProjectCredits(id.value).catch(() => null),
    ]);
    project.value = p;
    files.value = f;
    credits.value = c;
    if (!p.quote && !autoQuoted) {
      autoQuoted = true;
      project.value = await quoteProject(id.value, 0);
      credits.value = await getProjectCredits(id.value).catch(() => c);
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '项目读取失败';
  } finally {
    loading.value = false;
  }
}

/* 生成中：轮询项目状态与日志；离开页面自动停，回来继续。 */
let pollTimer: number | undefined;
let logOffset = 0;

async function poll() {
  if (!running.value) return;
  try {
    const p = await getProject(id.value);
    project.value = p;
    const log = await readProjectLog(id.value, logOffset);
    if (log.text) {
      logText.value += log.text;
      logOffset = log.next;
    }
    if (p.status !== 'running') {
      files.value = await projectFiles(id.value);
      if (p.status === 'done') error.value = '';
    }
  } catch {
    /* 轮询失败不打断页面 */
  }
}

watch(running, (on) => {
  window.clearInterval(pollTimer);
  if (on) {
    logOffset = 0;
    logText.value = '';
    pollTimer = window.setInterval(poll, 3000);
  }
});

onMounted(async () => {
  await refresh();
  if (running.value) {
    logOffset = 0;
    pollTimer = window.setInterval(poll, 3000);
  }
});
onUnmounted(() => window.clearInterval(pollTimer));

async function doQuote() {
  busy.value = 'quote';
  error.value = '';
  try {
    project.value = await quoteProject(id.value, 0);
    credits.value = await getProjectCredits(id.value).catch(() => credits.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '报价失败';
  } finally {
    busy.value = '';
  }
}

async function doRun() {
  busy.value = 'run';
  error.value = '';
  try {
    project.value = await runProject(id.value, quoteTotal.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '提交生成失败';
    project.value = await getProject(id.value).catch(() => project.value);
  } finally {
    busy.value = '';
  }
}

const runLabel = computed(() => {
  if (running.value) return '生成中，可随时离开本页';
  if (!isCloud.value) return project.value?.status === 'done' ? '重新渲染' : '开始渲染';
  if (insufficient.value) return '积分不足，无法生成';
  return project.value?.status === 'done' ? `重新生成（消耗 ${quoteTotal.value} 积分）` : `生成（消耗 ${quoteTotal.value} 积分）`;
});
</script>

<template>
  <div class="max-w-240 flex flex-col gap-4">
    <NSpin :show="loading">
      <div v-if="project" class="flex flex-col gap-4">
        <SectionCard :title="project.name" :subtitle="`${project.templateName} · ${project.id}`">
          <template #extra>
            <NTag :type="statusType" size="small" :bordered="false">{{ statusText }}</NTag>
          </template>

          <div class="flex flex-col gap-3">
            <div class="flex gap-3 p-3 border border-success rounded-control">
              <div class="w-6 h-6 rounded-full grid place-items-center bg-success-soft text-success font-bold flex-none text-xs">1</div>
              <div class="min-w-0">
                <div class="font-semibold text-ink">文稿</div>
                <div class="mt-1 text-xs text-ink-2 leading-5">已存到项目 input/script.txt，配音和发布简介都用它。</div>
              </div>
            </div>
            <div class="flex gap-3 p-3 border rounded-control" :class="project.quote ? 'border-success' : 'border-border'">
              <div class="w-6 h-6 rounded-full grid place-items-center bg-neutral-soft text-ink-2 font-bold flex-none text-xs">2</div>
              <div class="min-w-0 flex flex-col gap-2">
                <div class="font-semibold text-ink">{{ isCloud ? '报价' : '本机渲染' }}</div>
                <div class="text-xs text-ink-2 leading-5">
                  {{ isCloud ? '进项目自动查，报价只读不扣额度。' : '模板自带本机渲染入口，不走官方云端，0 积分。' }}
                </div>
                <NButton v-if="isCloud" size="small" type="primary" tertiary :loading="busy === 'quote'" @click="doQuote">刷新报价</NButton>
              </div>
            </div>
            <div class="flex gap-3 p-3 border rounded-control" :class="project.artifactRel ? 'border-success' : 'border-border'">
              <div class="w-6 h-6 rounded-full grid place-items-center bg-neutral-soft text-ink-2 font-bold flex-none text-xs">3</div>
              <div class="min-w-0">
                <div class="font-semibold text-ink">生成</div>
                <div class="text-xs text-ink-2 leading-5">提交后台任务，页面可以随时离开；进度在任务页和本页同步。</div>
              </div>
            </div>
            <div class="flex gap-3 p-3 border rounded-control" :class="project.status === 'done' ? 'border-success' : 'border-border'">
              <div class="w-6 h-6 rounded-full grid place-items-center bg-neutral-soft text-ink-2 font-bold flex-none text-xs">4</div>
              <div class="min-w-0">
                <div class="font-semibold text-ink">作品与发布</div>
                <div class="text-xs text-ink-2 leading-5">成片进入作品页，在那里配置标题、简介、话题与封面。</div>
              </div>
            </div>
          </div>

          <NAlert v-if="friendlyError" type="error" :show-icon="false" class="mt-3">{{ friendlyError }}</NAlert>
        </SectionCard>

        <SectionCard v-if="isCloud && project.quote" title="报价明细" subtitle="只读；官网账号余额不足时，正式生成会被拒绝">
          <div class="grid gap-2 mb-3">
            <div class="row-between text-xs px-3 py-2 rounded-control bg-neutral-soft">
              <span class="text-ink-2">配音</span>
              <b class="text-ink">{{ project.quote.tts?.model }} · {{ project.quote.tts?.credits }} 额度</b>
            </div>
            <div class="row-between text-xs px-3 py-2 rounded-control bg-neutral-soft">
              <span class="text-ink-2">编排</span>
              <b class="text-ink">{{ project.quote.compose?.model }} · {{ project.quote.compose?.credits }} 额度</b>
            </div>
            <div class="row-between text-xs px-3 py-2 rounded-control bg-neutral-soft">
              <span class="text-ink-2">合计</span>
              <b class="text-brand">{{ project.quote.total }} 额度</b>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4 text-xs mb-3">
            <div>
              <div class="font-semibold text-ink mb-1">会上传</div>
              <ul class="m-0 pl-4 text-ink-2 leading-6">
                <li v-for="u in project.quote.uploads" :key="u">{{ u }}</li>
              </ul>
            </div>
            <div>
              <div class="font-semibold text-ink mb-1">不会上传</div>
              <ul class="m-0 pl-4 text-ink-2 leading-6">
                <li v-for="u in project.quote.notUploaded" :key="u">{{ u }}</li>
              </ul>
            </div>
          </div>
          <div class="flex items-center gap-3 text-xs mb-3">
            <span class="text-ink-2">官方账号余额</span>
            <b class="text-ink num">{{ balance }} 积分</b>
            <span v-if="credits?.resets_at" class="text-ink-3">每月额度重置 {{ new Date(credits.resets_at).toLocaleDateString('zh-CN') }}</span>
          </div>
          <NAlert v-if="insufficient" type="warning" :show-icon="false">
            本次报价需要 {{ quoteTotal }} 积分，当前余额 {{ balance }}，生成会被官方直接拒绝。模板导入和本地服务不收费，这些积分是包内官方 Key 调云端配音和编排产生的。
          </NAlert>
        </SectionCard>

        <SectionCard title="生成" :subtitle="isCloud ? '按报价全额提交；扣的是官方积分' : '本机渲染，不消耗积分'">
          <div class="flex items-center gap-3 flex-wrap">
            <span v-if="!isCloud" class="text-sm text-ink-2">本地渲染 · <b class="text-ink">0</b> 积分</span>
            <span v-else class="text-sm text-ink-2">本次预计消耗 <b class="text-ink num">{{ quoteTotal }}</b> 官方积分</span>
            <NButton
              type="primary"
              :loading="busy === 'run' || running"
              :disabled="running || !project.quote || insufficient"
              @click="doRun"
            >
              {{ runLabel }}
            </NButton>
            <NButton v-if="project.jobId" size="small" @click="router.push('/jobs')">查看任务</NButton>
            <NButton v-if="project.status === 'done'" size="small" type="primary" tertiary @click="router.push('/works')">
              去作品页配置发布
            </NButton>
          </div>
          <NCollapse v-if="logText || running" class="mt-3">
            <NCollapseItem :title="running ? '生成日志（实时）' : '生成日志'" name="log">
              <pre class="m-0 p-3 rounded-control bg-bg text-xs text-ink-2 font-mono whitespace-pre-wrap break-all max-h-80 overflow-y-auto">{{ logText || '等待任务输出…' }}</pre>
            </NCollapseItem>
          </NCollapse>
        </SectionCard>

        <SectionCard v-if="project.videoUrl" title="成片" subtitle="生成产物已回填；发布配置请到作品页">
          <video class="w-full rounded-control bg-black" :src="project.videoUrl" controls playsinline />
          <div v-if="files?.video" class="mt-2 text-xs text-ink-3 font-mono break-all">{{ files.video }}</div>
        </SectionCard>
      </div>
    </NSpin>
  </div>
</template>
