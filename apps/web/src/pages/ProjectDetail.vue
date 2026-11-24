<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NSpin, NAlert, NTag, NCard, NCollapse, NCollapseItem, NIcon, NInput, NSelect, NImage, NText, useMessage } from 'naive-ui';
import { ArrowBackOutline } from '@vicons/ionicons5';
import {
  getProject,
  projectFiles,
  quoteProject,
  getProjectCredits,
  readProjectLog,
  getStudioConfig,
  saveStudioConfig,
  listProjectAssets,
  saveProjectText,
  type Project,
  type ProjectCredits,
  type ProjectFiles,
  type StudioConfig,
  type ProjectAsset,
} from '../api/projects';
import { listSamples } from '../api/tts';
import { assetUrl } from '../api/assets';
import type { Sample } from '../shared/types';
import SamplePlayer from '../components/media/SamplePlayer.vue';
import PromptCopyBlock from '../components/data/PromptCopyBlock.vue';
import { claimExclusive, releaseExclusive } from '../composables/useExclusivePlayer';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const id = computed(() => String(route.params.id ?? ''));

const project = ref<Project | null>(null);
const files = ref<ProjectFiles | null>(null);
const credits = ref<ProjectCredits | null>(null);
const config = ref<StudioConfig | null>(null);
const voicePreference = ref<string | null>(null);
const assets = ref<ProjectAsset[]>([]);
const samples = ref<Sample[]>([]);
const loading = ref(true);
const busy = ref('');
const voiceBusy = ref(false);
const textBusy = ref(false);
const error = ref('');
const logText = ref('');

const editName = ref('');
const editScript = ref('');

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

const projectDirRel = computed(() => `studio/projects/${project.value?.id ?? id.value}/`);

async function refresh() {
  loading.value = true;
  try {
    const [p, f, c, cfg, assetList, sampleList] = await Promise.all([
      getProject(id.value),
      projectFiles(id.value),
      getProjectCredits(id.value).catch(() => null),
      getStudioConfig(id.value).catch(() => null),
      listProjectAssets(id.value).catch(() => []),
      listSamples().catch(() => []),
    ]);
    project.value = p;
    files.value = f;
    credits.value = c;
    config.value = cfg;
    voicePreference.value = cfg?.voicePreference ?? null;
    assets.value = assetList;
    samples.value = sampleList;
    editName.value = p.name;
    editScript.value = p.scriptText ?? '';
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

/* 轻编辑：只改标题与文稿这类纯文本，创作入参文件仍交外部 AI。 */
async function saveText() {
  if (!project.value) return;
  textBusy.value = true;
  try {
    const updated = await saveProjectText(project.value.id, {
      name: editName.value,
      script: editScript.value,
    });
    project.value = updated;
    message.success('标题与文稿已保存');
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    textBusy.value = false;
  }
}

async function saveVoice() {
  if (!project.value) return;
  voiceBusy.value = true;
  try {
    config.value = await saveStudioConfig(project.value.id, {
      voicePreference: voicePreference.value,
    });
    message.success('音色偏好已保存');
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存音色失败');
  } finally {
    voiceBusy.value = false;
  }
}

const voiceOptions = computed(() =>
  samples.value.map((s) => ({ label: `${s.label}（${s.voice}）`, value: s.voice })),
);

const selectedSample = computed(() => samples.value.find((s) => s.voice === voicePreference.value) ?? null);
const previewPlaying = ref(false);
let previewAudio: HTMLAudioElement | null = null;

function stopPreview() {
  previewAudio?.pause();
}
const pausePreview = () => stopPreview();

async function togglePreview() {
  const sample = selectedSample.value;
  if (!sample?.url) return;
  if (previewAudio && previewPlaying.value) {
    stopPreview();
    return;
  }
  if (!previewAudio) {
    previewAudio = new Audio(sample.url);
    previewAudio.addEventListener('pause', () => {
      previewPlaying.value = false;
      releaseExclusive(pausePreview);
    });
    previewAudio.addEventListener('ended', () => {
      previewPlaying.value = false;
      releaseExclusive(pausePreview);
    });
  } else if (previewAudio.src !== sample.url) {
    previewAudio.src = sample.url;
  }
  claimExclusive(pausePreview);
  previewPlaying.value = true;
  try {
    await previewAudio.play();
  } catch {
    previewPlaying.value = false;
    releaseExclusive(pausePreview);
  }
}

watch(voicePreference, () => stopPreview());

onUnmounted(() => {
  stopPreview();
  releaseExclusive(pausePreview);
  if (previewAudio) {
    previewAudio.removeAttribute('src');
    previewAudio = null;
  }
});

const captionLines = computed(() =>
  ((editScript.value || project.value?.scriptText) ?? '')
    .split(/[。！？!?\n]/)
    .map((s) => s.trim())
    .filter(Boolean),
);

const voiceUrl = computed(() => (files.value?.voice ? assetUrl(files.value.voice) : null));
const voiceMeta = computed(() => files.value?.voiceMeta ?? null);

const imageAssets = computed(() => assets.value.filter((a) => a.type === 'image'));
const videoAssets = computed(() => assets.value.filter((a) => a.type === 'video'));
const audioAssets = computed(() => assets.value.filter((a) => a.type === 'audio'));

/* ---------- 交给外部 AI 的提示词（面板不直接执行重动作） ---------- */
const assetPrompt = computed(() => [
  `请为项目「${project.value?.name ?? ''}」补充素材。`,
  `项目目录："${projectDirRel.value}"`,
  '1. 素材先归集到该目录的 "input/assets/" 下（图片 / 音频 / 视频，单条 20MB 内）；这是面板归集地，不是模板硬性目录。',
  '2. 最终绑定进模板时，按所选模板 params.schema.json / 运行时 contract 的角色槽（人物、画面、配图等）填路径，未绑定的素材不算已使用。',
  '3. 在 "input/studio-config.json" 的 assets 数组里登记文件相对路径与类型。',
  '4. 不要改动 "input/script.txt" 与模板入参，除非我另外说明。',
].join('\n'));

const voicePrompt = computed(() => [
  `请为项目「${project.value?.name ?? ''}」生成配音。`,
  `项目目录："${projectDirRel.value}"`,
  '- 读取 "input/script.txt" 作为配音文稿。',
  `- 音色使用 ${voicePreference.value || '默认音色'}（偏好记在 "input/studio-config.json" 的 voicePreference）。`,
  '- 合成结果归集到 "input/voice.mp3"，并在 "input/voice.json" 记录音色与时长（秒）；是否绑定进渲染以模板的 voiceover 槽位为准。',
  '- 字幕时间码按语音词边界回写，不要改动画面文案。',
].join('\n'));

const runPrompt = computed(() => [
  `请按现有入参渲染项目「${project.value?.name ?? ''}」。`,
  `项目目录："${projectDirRel.value}"`,
  `- 模板：${project.value?.templateName ?? ''}（${isCloud.value ? '官方云端，消耗账号积分' : '本机渲染，0 积分'}）。`,
  '- 归集位置：入参 "input/user.json"（云端包为包内助手入参），文稿 "input/script.txt"，素材 "input/assets/"，配音 "input/voice.mp3"；入参槽位与容量以模板自身 schema / contract 为准。',
  '- 渲染产物输出到 "output/"，并把成片相对路径回写 "project.json" 的 artifactRel。',
  '- 渲染前先核对 basic 字段容量：keyword 中文 8 字内、explanation 中文 42 字内。',
].join('\n'));
</script>

<template>
  <div class="max-w-240 flex flex-col gap-4">
    <NButton secondary class="self-start" @click="router.push('/projects')">
      <template #icon>
        <NIcon :size="16"><ArrowBackOutline /></NIcon>
      </template>
      返回
    </NButton>
    <NSpin :show="loading">
      <div v-if="project" class="flex flex-col gap-4">
        <NCard>
          <template #header>
            <div class="min-w-0">
              <h2 class="m-0 text-base font-semibold text-ink truncate">{{ project.templateName }}</h2>
              <p class="m-0 mt-1 text-xs text-ink-2">{{ project.id }} · {{ projectDirRel }}</p>
            </div>
          </template>
          <template #header-extra>
            <NTag :type="statusType" size="small" :bordered="false">{{ statusText }}</NTag>
          </template>

          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-1">
              <span class="text-xs text-ink-2">标题（30 字内，可直接改）</span>
              <NInput v-model:value="editName" maxlength="30" show-count placeholder="作品标题" />
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs text-ink-2">口播文稿（可直接改）</span>
              <NInput v-model:value="editScript" type="textarea" :rows="5" placeholder="口播文稿" />
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <NButton type="primary" :loading="textBusy" @click="saveText">保存标题与文稿</NButton>
              <span class="text-xs text-ink-3">模板入参、素材绑定等创作文件，仍由外部 AI 工具修改</span>
            </div>
            <div v-if="captionLines.length" class="flex flex-col gap-1">
              <span class="text-xs text-ink-2">字幕稿（按句拆分，只读）</span>
              <ol class="m-0 pl-4 flex flex-col gap-1 text-sm text-ink-2">
                <li v-for="(line, i) in captionLines" :key="i">{{ line }}</li>
              </ol>
            </div>
          </div>

          <NAlert v-if="friendlyError" type="error" :show-icon="false" class="mt-3">{{ friendlyError }}</NAlert>
        </NCard>

        <NCard>
          <template #header>
            <div class="min-w-0">
              <h2 class="m-0 text-base font-semibold text-ink truncate">素材</h2>
              <p class="m-0 mt-1 text-xs text-ink-2">项目 input/assets 下的图片、音频、视频；清单按磁盘文件回显</p>
            </div>
          </template>
          <div class="flex flex-col gap-3">
            <div v-if="imageAssets.length || videoAssets.length" class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div v-for="a in [...imageAssets, ...videoAssets]" :key="a.rel" class="flex flex-col gap-1 border border-border rounded-control p-2">
                <div class="h-35 bg-divider rounded-control overflow-hidden grid place-items-center">
                  <NImage
                    v-if="a.type === 'image'"
                    :src="a.url ?? undefined"
                    object-fit="cover"
                    class="w-full"
                    :img-props="{ style: { width: '100%', height: '140px' } }"
                    :preview-srcs="imageAssets.map((m) => m.url ?? '')"
                  />
                  <video v-else :src="a.url ?? undefined" controls class="w-full h-full object-cover rounded-control" />
                </div>
                <span class="text-xs text-ink-2 truncate">{{ a.name }}</span>
                <span class="text-xs text-ink-3">{{ a.type }}</span>
              </div>
            </div>
            <div v-if="audioAssets.length" class="flex flex-col gap-3">
              <div v-for="a in audioAssets" :key="a.rel" class="card flex items-center gap-3 p-3">
                <div class="flex-1 min-w-0 flex flex-col gap-2">
                  <span class="text-sm text-ink truncate" :title="a.name">{{ a.name }}</span>
                  <SamplePlayer :url="a.url" />
                </div>
              </div>
            </div>
            <p v-if="!assets.length" class="m-0 text-xs text-ink-3">还没有素材文件。</p>
            <PromptCopyBlock
              title="补充素材"
              hint="面板不上传文件；把下面提示词复制给外部 AI，让它把素材落到项目目录并登记。"
              :prompt="assetPrompt"
            />
          </div>
        </NCard>

        <NCard>
          <template #header>
            <div class="min-w-0">
              <h2 class="m-0 text-base font-semibold text-ink truncate">配音与字幕</h2>
              <p class="m-0 mt-1 text-xs text-ink-2">{{ isCloud ? '官方云端包内助手负责配音与编排，音色以包内为准' : '选择配音音色；字幕稿按文稿拆分，时间码在配音生成后按语音回写' }}</p>
            </div>
          </template>
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1">
              <span class="text-xs text-ink-2">配音音色（偏好可直接保存）</span>
              <div class="flex items-center gap-2 flex-wrap">
                <NSelect
                  v-model:value="voicePreference"
                  :options="voiceOptions"
                  clearable
                  placeholder="先用默认音色，可去配音页试听"
                  class="w-72"
                  :disabled="isCloud"
                />
                <NButton
                  secondary
                  :disabled="!selectedSample?.url || isCloud"
                  @click="togglePreview"
                >
                  {{ previewPlaying ? '暂停' : '试听' }}
                </NButton>
                <NButton type="primary" :loading="voiceBusy" :disabled="isCloud" @click="saveVoice">保存音色</NButton>
                <NText type="link" @click="router.push('/tts')">听更多音色</NText>
              </div>
            </div>
            <div v-if="voiceUrl" class="flex flex-col gap-2 p-3 border border-border rounded-control">
              <SamplePlayer :url="voiceUrl" :duration-s="voiceMeta?.duration_s ?? 0" />
              <div class="text-xs text-ink-3 num">音色 {{ voiceMeta?.voice ?? '默认' }} · {{ voiceMeta?.duration_s ?? 0 }}s</div>
            </div>
            <PromptCopyBlock
              title="生成配音"
              hint="面板不直接跑配音合成；复制提示词给外部 AI，按文稿与偏好合成到项目目录。"
              :prompt="voicePrompt"
            />
          </div>
        </NCard>

        <NCard v-if="isCloud && project.quote">
          <template #header>
            <div class="min-w-0">
              <h2 class="m-0 text-base font-semibold text-ink truncate">报价明细</h2>
              <p class="m-0 mt-1 text-xs text-ink-2">只读；官网账号余额不足时，正式生成会被拒绝</p>
            </div>
          </template>
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
            <NButton size="tiny" secondary :loading="busy === 'quote'" @click="doQuote">刷新报价</NButton>
          </div>
          <NAlert v-if="insufficient" type="warning" :show-icon="false">
            本次报价需要 {{ quoteTotal }} 积分，当前余额 {{ balance }}，生成会被官方直接拒绝。模板导入和本地服务不收费，这些积分是包内官方 Key 调云端配音和编排产生的。
          </NAlert>
        </NCard>

        <NCard>
          <template #header>
            <div class="min-w-0">
              <h2 class="m-0 text-base font-semibold text-ink truncate">生成与产物</h2>
              <p class="m-0 mt-1 text-xs text-ink-2">{{ isCloud ? '按报价全额提交；扣的是官方积分' : '本机渲染，不消耗积分' }}</p>
            </div>
          </template>
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3 flex-wrap">
              <span v-if="!isCloud" class="text-sm text-ink-2">本地渲染 · <b class="text-ink">0</b> 积分</span>
              <span v-else class="text-sm text-ink-2">本次预计消耗 <b class="text-ink num">{{ quoteTotal }}</b> 官方积分</span>
              <NButton v-if="project.jobId" secondary @click="router.push('/jobs')">查看任务</NButton>
              <NButton v-if="project.status === 'done'" type="primary" tertiary @click="router.push('/works')">
                去作品页配置发布
              </NButton>
            </div>
            <PromptCopyBlock
              title="执行渲染"
              hint="面板不在本机直接触发渲染；复制提示词给外部 AI，按现有入参出片并回写产物路径。"
              :prompt="runPrompt"
            />
            <NCollapse v-if="logText || running" class="mt-1">
              <NCollapseItem :title="running ? '生成日志（实时）' : '生成日志'" name="log">
                <pre class="m-0 p-3 rounded-control bg-bg text-xs text-ink-2 font-mono whitespace-pre-wrap break-all max-h-80 overflow-y-auto">{{ logText || '等待任务输出…' }}</pre>
              </NCollapseItem>
            </NCollapse>
          </div>
        </NCard>

        <NCard v-if="project.videoUrl">
          <template #header>
            <div class="min-w-0">
              <h2 class="m-0 text-base font-semibold text-ink truncate">成片</h2>
              <p class="m-0 mt-1 text-xs text-ink-2">生成产物已回填；发布配置请到作品页</p>
            </div>
          </template>
          <video class="w-full rounded-control bg-black" :src="project.videoUrl" controls playsinline />
          <div v-if="files?.video" class="mt-2 text-xs text-ink-3 font-mono break-all">{{ files.video }}</div>
        </NCard>
      </div>
    </NSpin>
  </div>
</template>
