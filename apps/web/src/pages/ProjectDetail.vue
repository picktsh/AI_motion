<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NSpin, NAlert, NTag, NProgress } from 'naive-ui';
import {
  getProject,
  preparePublish,
  projectFiles,
  quoteProject,
  runProject,
  getProjectCredits,
  type Project,
  type ProjectCredits,
  type ProjectFiles,
} from '../api/projects';
import { assetUrl } from '../api/client';
import { endpoints } from '../api/endpoints';
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
let autoQuoted = false;

const balance = computed(() => Number(credits.value?.credits_remaining ?? credits.value?.account_balance?.available ?? 0));
const quoteTotal = computed(() => Number(project.value?.quote?.total ?? 0));
const insufficient = computed(() => quoteTotal.value > 0 && balance.value < quoteTotal.value);
const friendlyError = computed(() => {
  if (!error.value) return '';
  if (error.value.includes('insufficient_credits')) {
    return `官方账号积分不足：本次需要 ${quoteTotal.value}，余额 ${balance.value}。这不是本站服务端收费，是模板包内官方 Key 调云端配音/编排的额度不够。`;
  }
  return error.value;
});

const statusText = computed(() => {
  const map = { draft: '待报价', quoted: '已报价', running: '生成中', failed: '生成失败', done: '已成片' };
  return project.value ? map[project.value.status] : '';
});

const fileUrl = (rel: string | null) => (rel ? assetUrl(endpoints.assets.byPath(rel)) : '');

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
      const quoted = await quoteProject(id.value, 0);
      project.value = quoted;
      credits.value = await getProjectCredits(id.value).catch(() => c);
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '项目读取失败';
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);

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
    await refresh();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '生成失败';
    project.value = await getProject(id.value).catch(() => project.value);
  } finally {
    busy.value = '';
  }
}

async function doPublish() {
  busy.value = 'publish';
  error.value = '';
  try {
    project.value = await preparePublish(id.value);
    files.value = await projectFiles(id.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '生成发布配置失败';
  } finally {
    busy.value = '';
  }
}

async function copyPublishText() {
  if (!files.value?.publishTxt) return;
  const res = await fetch(fileUrl(files.value.publishTxt));
  await navigator.clipboard.writeText(await res.text());
}


</script>

<template>
  <div class="detail">
    <NSpin :show="loading">
      <div v-if="project" class="stack">
        <SectionCard :title="project.name" :subtitle="`${project.templateName} · ${project.id}`">
          <template #extra>
            <div class="tags">
              <NTag size="small" :bordered="false">{{ statusText }}</NTag>
              <NButton size="small" quaternary @click="router.push('/projects')">回项目列表</NButton>
            </div>
          </template>

          <div class="steps">
            <div class="step done">
              <div class="num">1</div>
              <div>
                <div class="t">文稿</div>
                <div class="d">已存到项目 input/script.txt，后面配音和发布简介都用它。</div>
              </div>
            </div>
            <div class="step" :class="{ done: !!project.quote }">
              <div class="num">2</div>
              <div>
                <div class="t">{{ project.kind === 'builtin' ? '本机渲染' : '报价' }}</div>
                <div class="d">{{ project.kind === 'builtin' ? '内置模板不走官方云端，直接本机适配器渲染，0 积分。' : '进项目就自动查，不需要你点；报价只读，不扣额度。' }}</div>
                <NButton v-if="project.kind !== 'builtin'" size="small" type="primary" tertiary :loading="busy === 'quote'" @click="doQuote">刷新报价</NButton>
              </div>
            </div>
            <div class="step" :class="{ done: project.status === 'done' }">
              <div class="num">3</div>
              <div>
                <div class="t">生成</div>
                <div class="d">按报价全额提交，包内助手真实配音、编排、出片；日志实时落盘。</div>
              </div>
            </div>
            <div class="step" :class="{ done: !!project.artifactRel }">
              <div class="num">4</div>
              <div>
                <div class="t">成片与发布配置</div>
                <div class="d">成片出来后自动切 4:3 / 3:4 封面，生成可直接粘贴的标题、简介、话题。</div>
              </div>
            </div>
          </div>

          <NAlert v-if="error" type="error" :show-icon="false" class="alert">{{ friendlyError }}</NAlert>
        </SectionCard>

        <SectionCard v-if="project.kind === 'builtin'" title="本机渲染" subtitle="不调官方云端，不消耗积分">
          <div class="qrow"><span>路线</span><b>studio/template/adapter.py · prepare → render</b></div>
          <div class="qrow total"><span>积分消耗</span><b>0</b></div>
        </SectionCard>

        <SectionCard v-if="project.kind !== 'builtin' && project.quote" title="报价明细" subtitle="只读；官网账号余额不足时，正式生成会被拒绝">
          <div class="quote">
            <div class="qrow"><span>配音</span><b>{{ project.quote.tts?.model }} · {{ project.quote.tts?.credits }} 额度</b></div>
            <div class="qrow"><span>编排</span><b>{{ project.quote.compose?.model }} · {{ project.quote.compose?.credits }} 额度</b></div>
            <div class="qrow total"><span>合计</span><b>{{ project.quote.total }} 额度</b></div>
          </div>
          <div class="cols">
            <div>
              <div class="h">会上传</div>
              <ul><li v-for="u in project.quote.uploads" :key="u">{{ u }}</li></ul>
            </div>
            <div>
              <div class="h">不会上传</div>
              <ul><li v-for="u in project.quote.notUploaded" :key="u">{{ u }}</li></ul>
            </div>
          </div>
          <div class="balance">
            <span>官方账号余额</span>
            <b>{{ balance }} 积分</b>
            <span class="resets" v-if="credits?.resets_at">每月额度重置 {{ new Date(credits.resets_at).toLocaleDateString('zh-CN') }}</span>
          </div>
          <NAlert v-if="insufficient" type="warning" :show-icon="false">
            本次报价需要 <b>{{ quoteTotal }}</b> 积分，当前余额 <b>{{ balance }}</b>，生成会被官方直接拒绝（insufficient_credits）。模板导入和本地服务不收费，这 2 积分是包内官方 Key 调云端配音和编排产生的。
          </NAlert>
        </SectionCard>

        <SectionCard title="正式生成" :subtitle="project.kind === 'builtin' ? '本机适配器渲染，不消耗积分' : '按报价全额提交；扣的是官方积分，不是本站余额'">
          <div class="runbar">
            <span v-if="project.kind === 'builtin'">本地渲染 · <b>0</b> 积分</span>
            <span v-else>本次预计消耗 <b>{{ quoteTotal }}</b> 官方积分</span>
            <NButton type="primary" :loading="busy === 'run'" :disabled="!project.quote || (project.kind === 'personal' && insufficient)" @click="doRun">
              {{ project.kind === 'builtin' ? '开始渲染' : insufficient ? '积分不足，无法生成' : `生成（消耗 ${quoteTotal} 积分）` }}
            </NButton>
            <span v-if="project.logRel" class="log">日志：{{ project.logRel }}</span>
          </div>
          <NProgress v-if="busy === 'run'" :percentage="100" status="info" :show-indicator="false" processing />
        </SectionCard>

        <SectionCard v-if="project.videoUrl" title="成片" subtitle="生成产物已回填；可直接预览">
          <video class="video" :src="project.videoUrl" controls playsinline />
        </SectionCard>

        <SectionCard title="发布配置" subtitle="成片 → 横竖封面 + 标题简介话题；文本一键复制，视频给本地路径">
          <div class="runbar">
            <NButton :disabled="!project.artifactRel" :loading="busy === 'publish'" @click="doPublish">生成发布配置</NButton>
            <NButton v-if="files?.publishTxt" quaternary @click="copyPublishText">复制标题+简介+话题</NButton>
          </div>

          <div v-if="files" class="files">
            <div class="file"><span>成片</span><code>{{ files.video ?? '还没有' }}</code></div>
            <div class="file"><span>横封面 4:3</span><code>{{ files.cover4x3 ?? '未生成' }}</code></div>
            <div class="file"><span>竖封面 3:4</span><code>{{ files.cover3x4 ?? '未生成' }}</code></div>
            <div class="file"><span>发布文案</span><code>{{ files.publishTxt ?? '未生成' }}</code></div>
          </div>

          <div v-if="files?.cover4x3 || files?.cover3x4" class="covers">
            <div v-if="files?.cover4x3" class="cover"><img :src="fileUrl(files.cover4x3)" alt="横封面" /><span>4:3</span></div>
            <div v-if="files?.cover3x4" class="cover"><img :src="fileUrl(files.cover3x4)" alt="竖封面" /><span>3:4</span></div>
          </div>

          <NAlert v-if="!project.artifactRel" type="info" :show-icon="false">
            成片和封面到抖音不能走剪贴板。本机方案是给绝对路径，在发布页直接选文件；云端方案是打包下载。文字部分始终可以复制。
          </NAlert>
        </SectionCard>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.detail { max-width: 980px; }
.stack { display: flex; flex-direction: column; gap: 16px; }
.tags { display: flex; align-items: center; gap: 8px; }
.steps { display: flex; flex-direction: column; gap: 12px; }
.step { display: flex; gap: 12px; padding: 12px; border: 1px solid var(--color-border); border-radius: 10px; }
.step.done { border-color: color-mix(in srgb, var(--color-success) 35%, var(--color-border)); }
.num { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--color-bg-subtle); font-weight: 700; flex: none; }
.t { font-weight: 600; }
.d { margin: 4px 0 8px; font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; }
.alert { margin-top: 12px; }
.quote { display: grid; gap: 8px; margin-bottom: 14px; }
.qrow { display: flex; justify-content: space-between; font-size: 13px; padding: 8px 10px; border-radius: 8px; background: var(--color-bg-subtle); }
.qrow.total b { color: var(--color-primary); }
.balance { display: flex; align-items: center; gap: 10px; font-size: 13px; margin: 10px 0; }
.balance b { color: var(--color-text-primary); }
.resets { color: var(--color-text-tertiary); font-size: 12px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px; margin-bottom: 12px; }
.h { font-weight: 600; margin-bottom: 6px; }
.cols ul { margin: 0; padding-left: 18px; color: var(--color-text-secondary); line-height: 1.8; }
.runbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.log { font-size: 12px; color: var(--color-text-tertiary); }
.video { width: 100%; border-radius: 10px; background: #000; }
.files { display: grid; gap: 8px; margin-top: 12px; }
.file { display: grid; grid-template-columns: 100px 1fr; gap: 8px; font-size: 13px; align-items: center; }
.file code { word-break: break-all; padding: 6px 8px; background: var(--color-bg-subtle); border-radius: 6px; }
.covers { display: flex; gap: 14px; margin-top: 14px; }
.cover { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--color-text-tertiary); }
.cover img { width: 200px; border-radius: 8px; display: block; }
</style>
