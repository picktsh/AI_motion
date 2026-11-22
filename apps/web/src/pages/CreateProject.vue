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

/** 只列有运行入口的模板；缺入口的在模板页标灰引导重新下载。 */
const usable = computed(() => templates.value.filter((t) => Boolean(t.runtime?.entry)));

const options = computed(() =>
  usable.value.map((t) => ({
    label: `${t.name}${t.version ? ` · v${t.version}` : ''}`,
    value: t.id,
  })),
);

const selected = computed(() => usable.value.find((t) => t.id === templateId.value) ?? null);

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
  <div class="max-w-220">
    <SectionCard title="从模板开始一条片子" subtitle="模板 → 文稿 → 报价 → 生成 → 作品页发布">
      <NSpin :show="loading">
        <div class="flex flex-col gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-ink-2">用哪个模板</span>
            <NSelect v-model:value="templateId" :options="options" placeholder="先去模板页导入一个官网模板" filterable />
            <span v-if="selected" class="text-xs text-ink-3 leading-5">
              {{ selected.paidCloud ? '官方云端：包内助手真实配音与编排，按官方积分计费。' : '本机渲染：模板自带渲染入口，不消耗官方积分。' }}
            </span>
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs text-ink-2">作品标题（发布时当标题，30 字内）</span>
            <NInput v-model:value="title" maxlength="30" show-count placeholder="例如：我用 AI 把一周的活干完了" />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs text-ink-2">口播文稿（旁白/台词，生成时按它配音）</span>
            <NInput v-model:value="script" type="textarea" :rows="7" placeholder="把要说的话整段贴进来；也可以先在外部 AI 写好再贴回来。" />
            <span class="text-xs text-ink-3 leading-5">当前 {{ script.trim().length }} 字。云端模板会按字数报价配音。</span>
          </label>

          <div class="flex gap-4 items-end flex-wrap">
            <label v-if="selected?.paidCloud" class="flex flex-col gap-1 w-44">
              <span class="text-xs text-ink-2">目标时长（秒）</span>
              <NInputNumber v-model:value="duration" :min="4" :step="2" />
            </label>
            <label class="flex flex-col gap-1 flex-1 min-w-60">
              <span class="text-xs text-ink-2">话题标签（逗号分隔，不带 #）</span>
              <NInput v-model:value="keywords" placeholder="AI剪辑, 像素风, 工作流" />
            </label>
          </div>
          <p v-if="selected && !selected.paidCloud" class="m-0 text-xs text-ink-3">
            本机渲染的时长由模板原生窗口决定，创建后自动读取，不需要在这里填。
          </p>

          <NAlert v-if="error" type="error" :show-icon="false">{{ error }}</NAlert>

          <div class="flex items-center gap-3 pt-1">
            <NButton type="primary" size="large" :loading="submitting" @click="submit">创建项目</NButton>
            <NTag v-if="selected" size="small" :bordered="false">{{ selected.name }}</NTag>
          </div>
        </div>
      </NSpin>
    </SectionCard>
  </div>
</template>
