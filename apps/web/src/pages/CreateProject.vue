<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NInput, NInputNumber, NSelect, NSpin, NAlert, NTag } from 'naive-ui';
import { listTemplates } from '../api/templates';
import { createProject } from '../api/projects';
import type { TemplateSummary } from '../shared/types';
import SectionCard from '../components/data/SectionCard.vue';

const route = useRoute();
const router = useRouter();

const templates = ref<TemplateSummary[]>([]);
const loading = ref(true);
const error = ref('');
const submitting = ref(false);

const title = ref('');
const script = ref('');
const duration = ref(30);
const keywords = ref('');
const templateId = ref(String(route.query.template ?? ''));

const options = computed(() =>
  templates.value
    .filter((t) => t.runtime?.entry === 'adapter.py' || t.packageProfile === 'personal-download-v1')
    .map((t) => ({
      label: `${t.name}${t.version ? ` · v${t.version}` : ''}${t.packageProfile === 'personal-download-v1' ? '（个人包）' : ''}`,
      value: t.id,
    })),
);

const selected = computed(() => templates.value.find((t) => t.id === templateId.value) ?? null);

onMounted(async () => {
  try {
    templates.value = await listTemplates();
    if (!templateId.value && options.value.length) templateId.value = options.value[0].value;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '模板列表读取失败';
  } finally {
    loading.value = false;
  }
});

async function submit() {
  if (!title.value.trim() || !script.value.trim() || !templateId.value) {
    error.value = '模板、标题、口播文稿都要填';
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    const p = await createProject({
      templateId: templateId.value,
      title: title.value.trim(),
      script: script.value.trim(),
      duration: duration.value,
      keywords: keywords.value,
    });
    router.push(`/projects/${encodeURIComponent(p.id)}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="create-page">
    <SectionCard title="从模板开始一条片子" subtitle="模板 → 文稿 → 报价 → 生成 → 发布，一条链路走到底">
      <NSpin :show="loading">
        <div class="form">
          <label class="field">
            <span class="label">用哪个模板</span>
            <NSelect v-model:value="templateId" :options="options" placeholder="先导入一个模板" filterable />
            <span v-if="selected" class="hint">
              {{ selected.packageProfile === 'personal-download-v1' ? '个人包：走包内 assistant/motion.mjs，官方 TTS/编排按次计费。' : '内置模板：本地适配器渲染，不消耗官方额度。' }}
            </span>
          </label>

          <label class="field">
            <span class="label">作品标题（发布时当标题，30 字内）</span>
            <NInput v-model:value="title" maxlength="30" show-count placeholder="例如：我用 AI 把一周的活干完了" />
          </label>

          <label class="field">
            <span class="label">口播文稿（旁白/台词，生成时按它配音）</span>
            <NInput v-model:value="script" type="textarea" :rows="7" placeholder="把要说的话整段贴进来；也可以先在外部 AI 写好再贴回来。" />
            <span class="hint">当前 {{ script.trim().length }} 字。个人包会按字数报价配音。</span>
          </label>

          <div class="row">
            <label class="field small">
              <span class="label">目标时长（秒）</span>
              <NInputNumber v-model:value="duration" :min="5" :step="1" />
            </label>
            <label class="field">
              <span class="label">话题标签（逗号分隔，不带 #）</span>
              <NInput v-model:value="keywords" placeholder="AI剪辑, 像素风, 工作流" />
            </label>
          </div>

          <NAlert v-if="error" type="error" :show-icon="false">{{ error }}</NAlert>

          <div class="actions">
            <NButton type="primary" size="large" :loading="submitting" @click="submit">创建项目，去报价</NButton>
            <NTag v-if="selected" size="small" :bordered="false">{{ selected.name }}</NTag>
          </div>
        </div>
      </NSpin>
    </SectionCard>
  </div>
</template>

<style scoped>
.create-page { max-width: 880px; }
.form { display: flex; flex-direction: column; gap: 18px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field.small { max-width: 180px; }
.label { font-size: 13px; color: var(--color-text-secondary); }
.hint { font-size: 12px; color: var(--color-text-tertiary); line-height: 1.5; }
.row { display: flex; gap: 16px; align-items: flex-end; }
.actions { display: flex; align-items: center; gap: 12px; padding-top: 4px; }
</style>
