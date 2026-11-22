<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NButton, NDrawer, NDrawerContent, NInput, NDynamicTags, NRadioGroup, NRadio,
  NSwitch, NSpin, NDatePicker, useMessage,
} from 'naive-ui';
import {
  listProjects, projectFiles, getPublish, savePublish, preparePublish,
  type Project, type ProjectFiles, type ProjectPublish,
} from '../api/projects';
import { assetUrl } from '../api/client';
import { endpoints } from '../api/endpoints';
import SectionCard from '../components/data/SectionCard.vue';
import EmptyState from '../components/data/EmptyState.vue';

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
const coverBusy = ref(false);
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

async function regenCovers() {
  if (!active.value) return;
  coverBusy.value = true;
  try {
    await preparePublish(active.value.id);
    files.value = await projectFiles(active.value.id);
    message.success('封面与发布文案已重新生成');
  } catch (e) {
    message.error(e instanceof Error ? e.message : '生成失败');
  } finally {
    coverBusy.value = false;
  }
}

async function copyText() {
  if (!files.value?.publishTxt) {
    message.warning('还没有发布文案，先点「生成封面与文案」');
    return;
  }
  const res = await fetch(fileUrl(files.value.publishTxt));
  await navigator.clipboard.writeText(await res.text());
  message.success('标题+简介+话题已复制');
}

async function copyPath(rel: string | null | undefined) {
  if (!rel) return;
  await navigator.clipboard.writeText(rel);
  message.success('相对路径已复制（工程根目录下）');
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <SectionCard title="作品" subtitle="已生成的成片在这里维护发布配置；制作进度在项目页">
      <template #extra>
        <NButton size="small" @click="router.push('/videos')">旧视频条目</NButton>
        <NButton size="small" type="primary" @click="router.push('/')">新建项目</NButton>
      </template>
      <NSpin :show="loading">
        <EmptyState
          v-if="!works.length && !loading"
          title="还没有作品"
          description="去创作页建一个项目，生成完成后成片会自动出现在这里。"
        />
        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div v-for="p in works" :key="p.id" class="card overflow-hidden flex flex-col">
            <video
              class="w-full aspect-video bg-black object-cover"
              :src="p.videoUrl ?? ''"
              preload="metadata"
              muted
              playsinline
            />
            <div class="p-4 flex flex-col gap-2 flex-1">
              <div class="font-semibold text-ink truncate">{{ p.name }}</div>
              <div class="text-xs text-ink-3 truncate">
                {{ p.templateName }} · {{ new Date(p.createdAt).toLocaleString() }} · {{ p.duration }}s
              </div>
              <div class="mt-auto flex items-center gap-2 pt-2">
                <NButton size="small" type="primary" @click="openPublish(p)">发布配置</NButton>
                <NButton size="small" @click="router.push(`/projects/${encodeURIComponent(p.id)}`)">项目详情</NButton>
              </div>
            </div>
          </div>
        </div>
      </NSpin>
    </SectionCard>

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
            <div class="row-between">
              <span class="text-xs text-ink-2">封面（4:3 横 / 3:4 竖）</span>
              <NButton size="tiny" :loading="coverBusy" @click="regenCovers">生成封面与文案</NButton>
            </div>
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

          <div class="flex flex-col gap-2 border-t border-divider pt-4">
            <div class="text-xs text-ink-2">交付物（工程根目录相对路径，点击复制）</div>
            <button
              v-for="f in [files?.video, files?.cover4x3, files?.cover3x4, files?.publishTxt]"
              :key="f ?? 'none'"
              class="text-left text-xs font-mono text-ink-2 bg-neutral-soft rounded-control px-3 py-2 border-0 cursor-pointer break-all hover:text-brand"
              :disabled="!f"
              @click="copyPath(f)"
            >
              {{ f ?? '未生成' }}
            </button>
          </div>
        </div>
        <template #footer>
          <div class="flex items-center gap-2">
            <NButton @click="copyText">复制标题+简介+话题</NButton>
            <NButton type="primary" :loading="saving" @click="doSave">保存配置</NButton>
          </div>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
