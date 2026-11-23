<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NButton, NDrawer, NDrawerContent, NInput, NDynamicTags, NRadioGroup, NRadio,
  NSwitch, NSpin, NDatePicker, useMessage,
} from 'naive-ui';
import {
  listProjects, projectFiles, getPublish, savePublish,
  type Project, type ProjectFiles, type ProjectPublish,
} from '../api/projects';
import { assetUrl } from '../api/client';
import { endpoints } from '../api/endpoints';
import EmptyState from '../components/data/EmptyState.vue';
import PromptCopyBlock from '../components/data/PromptCopyBlock.vue';

const router = useRouter();
const message = useMessage();

const items = ref<Project[]>([]);
const loading = ref(true);

/** 作品 = 已出成片的项目；制作中的留在项目页。 */
const works = computed(() => items.value.filter((p) => p.artifactRel));

async function load() {
  loading.value = true;
  try {
    items.value = await listProjects();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '作品读取失败');
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const fileUrl = (rel: string | null | undefined) => (rel ? assetUrl(endpoints.assets.byPath(rel)) : '');

/* ---------- 发布配置抽屉 ---------- */
const drawer = ref(false);
const active = ref<Project | null>(null);
const files = ref<ProjectFiles | null>(null);
const saving = ref(false);
const draft = reactive({
  title: '',
  body: '',
  hashtags: [] as string[],
  visibility: 'public',
  allowSave: true,
  publishAt: 'now',
  schedule: null as number | null,
});

async function openPublish(p: Project) {
  active.value = p;
  drawer.value = true;
  files.value = await projectFiles(p.id).catch(() => null);
  const saved = await getPublish(p.id).catch(() => null);
  if (saved) {
    draft.title = saved.title;
    draft.body = saved.body;
    draft.hashtags = [...saved.hashtags];
    draft.visibility = saved.visibility;
    draft.allowSave = saved.allowSave;
    draft.publishAt = saved.publishAt.startsWith('now') ? 'now' : 'schedule';
    draft.schedule = saved.publishAt.startsWith('now') ? null : Date.parse(saved.publishAt) || null;
  } else {
    draft.title = p.name;
    draft.body = '';
    draft.hashtags = [...p.keywords];
    draft.visibility = 'public';
    draft.allowSave = true;
    draft.publishAt = 'now';
    draft.schedule = null;
  }
}

async function doSave() {
  if (!active.value) return;
  saving.value = true;
  try {
    const payload: Partial<ProjectPublish> = {
      title: draft.title,
      body: draft.body,
      hashtags: draft.hashtags,
      visibility: draft.visibility,
      allowSave: draft.allowSave,
      publishAt: draft.publishAt === 'now' || !draft.schedule ? 'now' : new Date(draft.schedule).toISOString(),
    };
    await savePublish(active.value.id, payload);
    message.success('发布配置已保存');
    files.value = await projectFiles(active.value.id).catch(() => files.value);
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

const outputDirRel = computed(() => (active.value ? `studio/projects/${active.value.id}/output/` : ''));

const coverPrompt = computed(() => {
  const p = active.value;
  if (!p) return '';
  return [
    `请为项目「${p.name}」生成封面与发布文案。`,
    `- 项目目录："studio/projects/${p.id}/"`,
    '- 封面依据口播文稿、作品主题与项目里的人物素材，用 AI 生成图片（不从成片截帧），出 4:3（1440×1080）cover-4x3.jpg 与 3:4（1080×1440）cover-3x4.jpg。',
    '- 封面图与文案不要直接写本地磁盘；先提交给后端接口，由后端服务落到该项目 "output/" 目录。',
    '- 标题：依据口播文稿与主题，由 AI 优化出 30 字内、有点击钩子、贴合平台风格的标题；可先给多个候选，再择优定稿一个。',
    '- 简介：从口播文稿提炼，1000 字内，口语化讲清这条片子的看点与价值，保留关键信息，不堆砌套话。',
    '- 话题：先查同类内容当前的热门话题与标签，再从中筛选与本作品主题、受众关联度高的若干个；只保留相关的，不蹭无关的热门词。',
    '- 标题、简介、话题整理后通过接口回写 "output/publish.json" 与 "output/publish.txt"。',
    '- 不要改动成片本身。',
  ].join('\n');
});

async function copyText() {
  if (!files.value?.publishTxt) {
    message.warning('还没有发布文案，先点「生成封面与文案」');
    return;
  }
  const res = await fetch(fileUrl(files.value.publishTxt));
  await navigator.clipboard.writeText(await res.text());
  message.success('标题+简介+话题已复制');
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="row-between">
      <div class="min-w-0">
        <h2 class="page-title">作品</h2>
        <p class="page-desc mt-1">已生成的成片在这里维护发布配置；制作进度在项目页</p>
      </div>
      <NButton size="small" type="primary" @click="router.push('/create')">新建项目</NButton>
    </div>
    <NSpin :show="loading">
      <EmptyState
        v-if="!works.length && !loading"
        title="还没有作品"
        description="项目渲染出成片后，会自动出现在这里。"
      />
      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div v-for="p in works" :key="p.id" class="card overflow-hidden flex flex-col">
          <video
            class="w-full aspect-video bg-black object-contain"
            :src="p.videoUrl ?? ''"
            preload="metadata"
            controls
            playsinline
          />
          <div class="p-4 flex flex-col gap-2 flex-1">
            <div class="font-semibold text-ink truncate">{{ p.name }}</div>
            <div class="text-xs text-ink-3 truncate">
              {{ p.templateName }} · {{ new Date(p.createdAt).toLocaleString() }} · {{ p.duration }}s
            </div>
            <div class="mt-auto flex items-center gap-2 pt-2">
              <NButton size="small" type="primary" @click="openPublish(p)">发布配置</NButton>
              <NButton size="small" secondary @click="router.push(`/projects/${encodeURIComponent(p.id)}`)">项目详情</NButton>
            </div>
          </div>
        </div>
      </div>
    </NSpin>

    <NDrawer v-model:show="drawer" :width="480">
      <NDrawerContent :title="`发布配置 · ${active?.name ?? ''}`" closable>
        <div v-if="active" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <span class="text-xs text-ink-2">标题（30 字内）</span>
            <NInput v-model:value="draft.title" maxlength="30" show-count placeholder="作品标题" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-ink-2">简介（1000 字内）</span>
            <NInput v-model:value="draft.body" type="textarea" maxlength="1000" show-count :rows="5" placeholder="发布简介，可用口播文稿" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-ink-2">话题标签</span>
            <NDynamicTags v-model:value="draft.hashtags" />
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-xs text-ink-2">封面（4:3 横 / 3:4 竖）</span>
            <div class="flex gap-3">
              <div class="flex flex-col gap-1 items-center">
                <img v-if="files?.cover4x3" :src="fileUrl(files.cover4x3)" class="w-40 rounded-control border border-border" alt="横封面" />
                <div v-else class="w-40 h-30 rounded-control border border-dashed border-border grid place-items-center text-xs text-ink-3">未生成</div>
                <span class="text-xs text-ink-3">4:3</span>
              </div>
              <div class="flex flex-col gap-1 items-center">
                <img v-if="files?.cover3x4" :src="fileUrl(files.cover3x4)" class="w-30 rounded-control border border-border" alt="竖封面" />
                <div v-else class="w-30 h-40 rounded-control border border-dashed border-border grid place-items-center text-xs text-ink-3">未生成</div>
                <span class="text-xs text-ink-3">3:4</span>
              </div>
            </div>
            <PromptCopyBlock
              title="生成封面与文案"
              hint="面板不直接生成封面；复制提示词给外部 AI，依据文稿、主题与人物素材生图出双比例封面，再经后端接口落盘并回写发布文案。"
              :prompt="coverPrompt"
            />
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-xs text-ink-2">谁可以看</span>
            <NRadioGroup v-model:value="draft.visibility">
              <NRadio value="public">公开</NRadio>
              <NRadio value="friends">好友</NRadio>
              <NRadio value="private">仅自己</NRadio>
            </NRadioGroup>
          </div>
          <div class="row-between">
            <span class="text-xs text-ink-2">允许他人保存视频</span>
            <NSwitch v-model:value="draft.allowSave" />
          </div>
          <div class="flex flex-col gap-2">
            <span class="text-xs text-ink-2">发布时间</span>
            <NRadioGroup v-model:value="draft.publishAt">
              <NRadio value="now">立即发布</NRadio>
              <NRadio value="schedule">定时发布</NRadio>
            </NRadioGroup>
            <NDatePicker v-if="draft.publishAt === 'schedule'" v-model:value="draft.schedule" type="datetime" class="w-full" />
          </div>

          <PromptCopyBlock
            title="交付物目录"
            hint="工程根目录相对路径；只给到目录，不带文件名"
            :prompt="outputDirRel"
            button-text="复制目录"
            :disabled="!outputDirRel"
          />
        </div>
        <template #footer>
          <div class="flex items-center gap-2">
            <NButton secondary @click="copyText">复制标题+简介+话题</NButton>
            <NButton type="primary" :loading="saving" @click="doSave">保存配置</NButton>
          </div>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
