<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NButton, NInput, NInputNumber, NSelect, NSpin, NTag, NForm, NFormItem, NAlert, NIcon,
  type FormInst, type FormRules,
} from 'naive-ui';
import {
  CubeOutline, FolderOpenOutline, AlbumsOutline, MicOutline,
} from '@vicons/ionicons5';
import { listTemplates } from '../api/templates';
import { listProjects, createProject, type Project } from '../api/projects';
import type { TemplateSummary } from '../shared/types';
import SectionCard from '../components/data/SectionCard.vue';

const route = useRoute();
const router = useRouter();

const templates = ref<TemplateSummary[]>([]);
const projects = ref<Project[]>([]);
const loading = ref(true);
const submitting = ref(false);
const backendError = ref('');
const formRef = ref<FormInst | null>(null);

const form = reactive({
  templateId: String(route.query.template ?? ''),
  title: '',
  script: '',
  duration: 30,
});

const rules: FormRules = {
  templateId: { required: true, message: '请选择一个模板', trigger: ['change', 'blur'] },
  title: [
    { required: true, message: '请填写作品标题', trigger: ['blur', 'input'] },
    { max: 30, message: '标题不超过 30 字', trigger: ['blur', 'input'] },
  ],
  script: { required: true, message: '请填写口播文稿', trigger: ['blur', 'input'] },
};

/** 只列有运行入口的模板；缺入口的在模板页标灰引导重新下载。 */
const usable = computed(() => templates.value.filter((t) => Boolean(t.runtime?.entry)));

const options = computed(() =>
  usable.value.map((t) => ({
    label: `${t.name}${t.version ? ` · v${t.version}` : ''}`,
    value: t.id,
  })),
);

const selected = computed(() => usable.value.find((t) => t.id === form.templateId) ?? null);

const stats = computed(() => ({
  total: projects.value.length,
  done: projects.value.filter((p) => p.status === 'done').length,
  active: projects.value.filter((p) => ['draft', 'quoted', 'running'].includes(p.status)).length,
}));

const shortcuts = [
  { label: '模板库', desc: '导入官网 .motion 模板', icon: CubeOutline, to: '/templates' },
  { label: '我的项目', desc: '跟踪文稿、报价与生成', icon: FolderOpenOutline, to: '/projects' },
  { label: '作品', desc: '成片发布配置与封面', icon: AlbumsOutline, to: '/works' },
  { label: '配音试音', desc: 'edge-tts 音色试听', icon: MicOutline, to: '/tts' },
];

onMounted(async () => {
  try {
    const [t, p] = await Promise.all([listTemplates(), listProjects().catch(() => [])]);
    templates.value = t;
    projects.value = p;
    if (!form.templateId && options.value.length) form.templateId = options.value[0].value;
  } catch (e) {
    backendError.value = e instanceof Error ? e.message : '模板列表读取失败';
  } finally {
    loading.value = false;
  }
});

async function submit() {
  backendError.value = '';
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    const p = await createProject({
      templateId: form.templateId,
      title: form.title.trim(),
      script: form.script.trim(),
      duration: form.duration,
    });
    router.push(`/projects/${encodeURIComponent(p.id)}`);
  } catch (e) {
    backendError.value = e instanceof Error ? e.message : '创建失败';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="max-w-220 flex flex-col gap-4">
    <NSpin :show="loading">
      <div class="flex flex-col gap-6">
      <!-- 概览统计 -->
      <div class="grid grid-cols-3 gap-4">
        <div class="card p-4 flex flex-col gap-1">
          <span class="text-xs text-ink-3">项目总数</span>
          <span class="text-2xl font-semibold text-ink num">{{ stats.total }}</span>
        </div>
        <div class="card p-4 flex flex-col gap-1">
          <span class="text-xs text-ink-3">已成片</span>
          <span class="text-2xl font-semibold text-success num">{{ stats.done }}</span>
        </div>
        <div class="card p-4 flex flex-col gap-1">
          <span class="text-xs text-ink-3">进行中</span>
          <span class="text-2xl font-semibold text-brand num">{{ stats.active }}</span>
        </div>
      </div>

      <!-- 快捷入口 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          v-for="s in shortcuts"
          :key="s.to"
          class="card p-4 cursor-pointer transition duration-150 hover:border-brand flex flex-col gap-2"
          @click="router.push(s.to)"
        >
          <NIcon :size="20" class="text-brand"><component :is="s.icon" /></NIcon>
          <div class="font-semibold text-ink">{{ s.label }}</div>
          <div class="text-xs text-ink-3 leading-5">{{ s.desc }}</div>
        </div>
      </div>

      <!-- 创作表单 -->
      <SectionCard title="新建工程目录" subtitle="选模板、填标题与文稿建立工程骨架；入参调整与渲染交给外部 AI 工具">
        <NForm ref="formRef" :model="form" :rules="rules" label-placement="top" class="flex flex-col gap-4">
          <NFormItem label="用哪个模板" path="templateId" label-class="text-xs text-ink-2">
            <NSelect v-model:value="form.templateId" :options="options" placeholder="先去模板页导入一个官网模板" filterable />
          </NFormItem>
          <p v-if="selected" class="m-0 text-xs text-ink-3 leading-5">
            {{ selected.paidCloud ? '官方云端：包内助手真实配音与编排，按官方积分计费。' : '本机渲染：模板自带渲染入口，不消耗官方积分。' }}
          </p>

          <NFormItem label="作品标题（发布时当标题，30 字内）" path="title" label-class="text-xs text-ink-2">
            <NInput v-model:value="form.title" maxlength="30" show-count placeholder="例如：我用 AI 把一周的活干完了" />
          </NFormItem>

          <NFormItem label="口播文稿（旁白/台词，生成时按它配音）" path="script" label-class="text-xs text-ink-2">
            <NInput v-model:value="form.script" type="textarea" :rows="7" placeholder="把要说的话整段贴进来；也可以先在外部 AI 写好再贴回来。" />
          </NFormItem>
          <p class="m-0 text-xs text-ink-3 leading-5">当前 {{ form.script.trim().length }} 字。云端模板会按字数报价配音。</p>

          <NFormItem v-if="selected?.paidCloud" label="目标时长（秒）" class="w-44" label-class="text-xs text-ink-2">
            <NInputNumber v-model:value="form.duration" :min="4" :step="2" class="w-full" />
          </NFormItem>
          <p v-if="selected && !selected.paidCloud" class="m-0 text-xs text-ink-3">
            本机渲染的时长由模板原生窗口决定，创建后自动读取，不需要在这里填。
          </p>

          <NAlert v-if="backendError" type="error" :show-icon="false">{{ backendError }}</NAlert>

          <div class="flex items-center gap-3 pt-1">
            <NButton type="primary" size="large" :loading="submitting" @click="submit">创建项目</NButton>
            <NTag v-if="selected" size="small" :bordered="false">{{ selected.name }}</NTag>
          </div>
        </NForm>
      </SectionCard>
      </div>
    </NSpin>
  </div>
</template>
