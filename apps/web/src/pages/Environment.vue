<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NSelect,
  NSkeleton,
  NTag,
  useMessage,
} from 'naive-ui';
import { PROTOCOL_VERSION } from '@ai-motion/shared/constants';
import { FolderOpenOutline, OpenOutline, RefreshOutline } from '@vicons/ionicons5';
import { getEnvironment } from '../api/environment';
import { getRuntimeConfig } from '../api/runtime';
import { pingHealth } from '../api/health';
import { aiChat, listAiProviders, saveAiProvider, type AiProviderView } from '../api/ai';
import { useFetch } from '../composables/useFetch';
import { useServerConfig } from '../composables/useServerConfig';
import PathCopy from '../components/data/PathCopy.vue';
import type { EnvItem, RuntimeItem, RuntimeReport } from '../shared/types';

const { data, loading, error, run } = useFetch(() => getEnvironment());


/* ---------- AI 助手（BYOK，本地配置） ---------- */
const providers = ref<AiProviderView[]>([]);
const aiProviderId = ref('ark');
const aiBaseUrl = ref('');
const aiModel = ref('');
const aiKey = ref('');
const aiSaving = ref(false);
const aiTesting = ref(false);
const aiReply = ref('');
/** 非空/格式校验只标红对应输入框，不弹顶部提示；请求真正发出后的失败才走 message。 */
const aiErrors = reactive({ baseUrl: false, model: false, key: false });

function clearAiErrors(): void {
  aiErrors.baseUrl = false;
  aiErrors.model = false;
  aiErrors.key = false;
}

const providerOptions = computed(() => providers.value.map((p) => ({ label: p.name, value: p.id })));

function syncAiForm(id: string): void {
  const p = providers.value.find((x) => x.id === id);
  if (!p) return;
  aiBaseUrl.value = p.baseUrl;
  aiModel.value = p.model;
  aiKey.value = '';
  clearAiErrors();
}

async function loadAi(): Promise<void> {
  try {
    providers.value = await listAiProviders();
    const saved = providers.value.find((p) => p.id === aiProviderId.value) ?? providers.value[0];
    if (saved) {
      aiProviderId.value = saved.id;
      syncAiForm(saved.id);
    }
  } catch {
    providers.value = [];
  }
}

async function saveAi(): Promise<void> {
  aiErrors.baseUrl = !/^https?:\/\//.test(aiBaseUrl.value.trim());
  aiErrors.model = !aiModel.value.trim();
  if (aiErrors.baseUrl || aiErrors.model) return;
  aiSaving.value = true;
  try {
    const body: { baseUrl: string; model: string; apiKey?: string } = {
      baseUrl: aiBaseUrl.value.trim(),
      model: aiModel.value.trim(),
    };
    if (aiKey.value.trim()) body.apiKey = aiKey.value.trim();
    const saved = await saveAiProvider(aiProviderId.value, body);
    providers.value = providers.value.map((p) => (p.id === saved.id ? saved : p));
    aiKey.value = '';
    message.success(`已保存 ${saved.name}${saved.hasKey ? '，Key 已掩码显示' : '（未填 Key）'}`);
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    aiSaving.value = false;
  }
}

async function testAi(): Promise<void> {
  aiErrors.baseUrl = !/^https?:\/\//.test(aiBaseUrl.value.trim());
  aiErrors.model = !aiModel.value.trim();
  const saved = providers.value.find((p) => p.id === aiProviderId.value);
  aiErrors.key = !saved?.hasKey && !aiKey.value.trim();
  if (aiErrors.baseUrl || aiErrors.model || aiErrors.key) return;
  aiTesting.value = true;
  aiReply.value = '';
  try {
    const res = await aiChat(aiProviderId.value, '只回复两个字：连通');
    aiReply.value = res.text.slice(0, 200);
    message.success(`${res.model} 已连通`);
  } catch (e) {
    message.error(e instanceof Error ? e.message : '调用失败');
  } finally {
    aiTesting.value = false;
  }
}

onMounted(() => void loadAi());

/* ---------- 运行配置（后端单一来源，只读） ---------- */
const runtime = ref<RuntimeReport | null>(null);
const runtimeError = ref('');

/** 配置项来源标注：环境变量 / 本地配置文件 / 内置缺省。 */
function sourceLabel(row: RuntimeItem): string {
  if (row.source === 'env') return `环境变量 ${row.origin ?? ''}`;
  if (row.source === 'file') return '本地配置 config/local.json';
  return `默认 ${row.fallback ?? '—'}`;
}

const protocolMismatch = ref(false);

async function loadRuntime(): Promise<void> {
  runtimeError.value = '';
  try {
    const report = await getRuntimeConfig();
    runtime.value = report;
    // 契约比对：后端协议与前端声明不一致时明确提示，避免旧前端静默读到新接口口径。
    protocolMismatch.value = report.protocol !== PROTOCOL_VERSION;
    if (protocolMismatch.value) {
      message.warning(`后端协议版本 ${report.protocol} 与面板 ${PROTOCOL_VERSION} 不一致，请同步更新前端或后端`);
    }
  } catch (e) {
    runtimeError.value = e instanceof Error ? e.message : String(e);
  }
}

onMounted(() => {
  run();
  void loadRuntime();
});

function reloadAll(): void {
  run();
  void loadRuntime();
}


/* ---------- 后端连接配置（与看门页同一来源，可查看可修改） ---------- */
const message = useMessage();
const { state, save, reset, defaultOrigin } = useServerConfig();
const origin = ref(state.origin || defaultOrigin);
const accessKey = ref(state.accessKey);
const testing = ref(false);
const originError = ref(false);

async function testConnection(): Promise<void> {
  testing.value = true;
  originError.value = false;
  try {
    const res = await pingHealth(origin.value, accessKey.value);
    if (res.ok) {
      message.success(res.message);
    } else {
      originError.value = true;
      message.error(res.message);
    }
  } finally {
    testing.value = false;
  }
}

function saveConnection(): void {
  save(origin.value, accessKey.value);
  originError.value = false;
  message.success('已保存');
}

function resetConnection(): void {
  reset();
  origin.value = defaultOrigin;
  accessKey.value = '';
  originError.value = false;
  message.success('已恢复默认本机地址');
}

const GROUPS: { title: string; keys: string[] }[] = [
  { title: '运行时', keys: ['node', 'pnpm', 'uv'] },
  { title: '媒体工具', keys: ['ffmpeg', 'ffprobe'] },
  { title: '渲染浏览器', keys: ['chrome'] },
  { title: '工程依赖', keys: ['nodeDeps', 'pythonVenv', 'binTools'] },
];

// 各工具官方下载/文档地址；本地目录类依赖不挂外链
const DOWNLOAD_LINKS: Record<string, string> = {
  node: 'https://nodejs.org/',
  pnpm: 'https://pnpm.io/',
  uv: 'https://docs.astral.sh/uv/',
  ffmpeg: 'https://ffmpeg.org/download.html',
  ffprobe: 'https://ffmpeg.org/download.html',
};

// 渲染浏览器兼容多个 Chromium 内核，并列推荐下载入口；Edge 国内可直接访问
const BROWSER_LINKS = [
  { name: 'Edge', url: 'https://www.microsoft.com/zh-cn/edge' },
  { name: 'Chrome', url: 'https://www.google.com/chrome/' },
];

function downloadLink(key: string): string | null {
  return DOWNLOAD_LINKS[key] ?? null;
}

const items = computed<EnvItem[]>(() => data.value?.items ?? []);
const summary = computed(() => data.value?.summary ?? { ok: 0, total: 0 });
const progress = computed(() =>
  summary.value.total ? summary.value.ok / summary.value.total : 0,
);

const groups = computed(() =>
  GROUPS.map((g) => ({
    title: g.title,
    items: items.value.filter((i) => g.keys.includes(i.key)),
  })).filter((g) => g.items.length),
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h2 class="m-0 text-xl font-semibold text-ink">创作环境</h2>
        <p class="m-0 mt-1 text-sm text-ink-2">检查本机工具与项目依赖，缺少的项目会给出修复线索。</p>
      </div>
      <NButton secondary :loading="loading" @click="reloadAll">
        <template #icon><NIcon :size="16"><RefreshOutline /></NIcon></template>
        重新检查
      </NButton>
    </div>

    <NEmpty v-if="error" :description="error">
      <template #icon>
        <NIcon class="text-danger"><FolderOpenOutline /></NIcon>
      </template>
      <template #default>
        <div class="flex flex-col items-center gap-2">
          <p class="m-0 text-xs text-ink-3">环境信息加载失败</p>
          <NButton type="primary" @click="run">重试</NButton>
        </div>
      </template>
    </NEmpty>

    <div v-else-if="loading">
      <NSkeleton text :repeat="4" class="w-full" />
    </div>

    <template v-else-if="data">
      <section class="glass-surface rounded-[24px] p-5 sm:p-6">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-4">
            <span class="w-12 h-12 flex-none grid place-items-center rounded-2xl" :class="summary.ok === summary.total ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'">
              <span class="text-lg font-bold">{{ summary.ok === summary.total ? '✓' : '!' }}</span>
            </span>
            <div>
              <div class="text-base font-semibold text-ink">{{ summary.ok === summary.total ? '创作环境已就绪' : '还有依赖需要补齐' }}</div>
              <div class="mt-1 text-xs text-ink-2">工具与项目依赖的检测结果</div>
            </div>
          </div>
          <div class="flex items-baseline gap-1 rounded-2xl bg-glass-soft border border-glass-border px-4 py-2">
            <span class="text-2xl font-semibold text-ink num">{{ summary.ok }}</span>
            <span class="text-sm text-ink-3">/ {{ summary.total }} 就绪</span>
          </div>
        </div>
        <div class="mt-5 h-2 rounded-full bg-glass-soft overflow-hidden">
          <div
            class="h-full rounded-full transition-[width] duration-300"
            :class="summary.ok === summary.total ? 'bg-success' : 'bg-brand'"
            :style="{ width: `${Math.round(progress * 100)}%` }"
          />
        </div>
      </section>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section v-for="g in groups" :key="g.title" class="min-w-0">
          <NCard :title="g.title" class="h-full">
          <div class="flex flex-col gap-2">
            <div
              v-for="item in g.items"
              :key="item.key"
              class="flex flex-col gap-2 p-3 rounded-2xl border transition-colors"
              :class="item.ok ? 'border-transparent bg-glass-soft' : 'border-warning/30 bg-warning-soft'"
            >
              <div class="flex items-center gap-2 min-w-0 flex-wrap">
                <span class="w-2 h-2 rounded-full flex-none" :class="item.ok ? 'bg-success' : 'bg-warning'" />
                <span class="text-sm font-medium text-ink">{{ item.label }}</span>
                <span class="text-xs text-ink-3 num">{{ item.version || '—' }}</span>
                <span class="ml-auto px-2.5 py-1 rounded-full text-[10px] font-semibold" :class="item.ok ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'">
                  {{ item.ok ? '就绪' : '待修复' }}
                </span>
                <template v-if="item.key === 'chrome'">
                  <a
                    v-for="b in BROWSER_LINKS"
                    :key="b.name"
                    :href="b.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-control border border-border text-xs text-ink-2 hover:text-brand hover:border-brand"
                    :title="`下载 ${b.name}`"
                  >
                    {{ b.name }}
                    <NIcon :size="12"><OpenOutline /></NIcon>
                  </a>
                </template>
                <a
                  v-else-if="downloadLink(item.key)"
                  :href="downloadLink(item.key) ?? undefined"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex-none text-ink-2 hover:text-brand"
                  :title="`前往 ${item.label} 官网下载`"
                >
                  <NIcon :size="12"><OpenOutline /></NIcon>
                </a>
              </div>
              <div v-if="item.desc" class="pl-4 text-xs text-ink-3 leading-5">{{ item.desc }}</div>
              <div class="pl-4 min-w-0">
                <PathCopy :path="item.path || '—'" inline />
              </div>
              <div v-if="!item.ok && item.hint" class="flex items-start gap-2 pl-4 text-xs text-warning">
                <span class="flex-none text-ink-3">提示</span>
                <PathCopy :path="item.hint" inline />
              </div>
            </div>
          </div>
          </NCard>
        </section>
      </div>

      <NEmpty v-if="!items.length" description="未检测到环境项" />
    </template>

    <NCard title="运行配置">
      <template #header-extra>
        <div class="flex items-center gap-2 flex-wrap">
          <NTag v-if="protocolMismatch" size="small" :bordered="false" type="warning">
            协议版本 {{ runtime?.protocol }} ≠ 面板 {{ PROTOCOL_VERSION }}
          </NTag>
          <NTag
            v-if="runtime"
            size="small"
            :bordered="false"
            :type="runtime.auth.enabled ? 'success' : 'default'"
          >
            {{
              runtime.auth.enabled
                ? `访问密钥已启用（${runtime.auth.keyCount} 把${runtime.auth.keyLength ? `，长度 ${runtime.auth.keyLength}` : ''}）`
                : '未启用访问密钥'
            }}
          </NTag>
        </div>
      </template>

      <NEmpty v-if="runtimeError" :description="runtimeError">
        <template #default>
          <NButton type="primary" @click="loadRuntime">重试</NButton>
        </template>
      </NEmpty>

      <template v-else-if="runtime">
        <p class="m-0 mb-3 text-xs leading-5 text-ink-3">
          值来自后端实时读取的运行配置；优先级为环境变量 &gt; 本地配置文件 &gt; 内置缺省。{{ runtime.auth.note }}
        </p>
        <NDescriptions :column="1" size="small" label-placement="left" bordered>
          <NDescriptionsItem
            v-for="row in runtime.items"
            :key="row.key"
            :label="`${row.label}（${sourceLabel(row)}）`"
          >
            <span class="text-sm break-all">{{ row.value }}</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="工程根">
            <PathCopy :path="runtime.paths.root" inline />
          </NDescriptionsItem>
          <NDescriptionsItem label="读取白名单">
            <span class="text-xs font-mono break-all">{{ runtime.paths.read.join('、') }}</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="可写根">
            <span class="text-xs font-mono break-all">{{ runtime.paths.write.join('、') }}</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="监听根">
            <span class="text-xs font-mono break-all">{{ runtime.paths.watch.join('、') }}</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="文本读写上限">
            <span class="text-xs num">
              读 {{ Math.round(runtime.textLimits.readBytes / 1024) }}KB / 写
              {{ Math.round(runtime.textLimits.writeBytes / 1024) }}KB，限
              {{ runtime.textLimits.extensions.join(' ') }}
            </span>
          </NDescriptionsItem>
        </NDescriptions>
      </template>
    </NCard>


    <NCard>
      <template #header>
        <div class="min-w-0">
          <h2 class="m-0 text-base font-semibold text-ink truncate">AI 助手（BYOK）</h2>
          <p class="m-0 mt-1 text-xs text-ink-2">Key 只存本机 config/ai.json，页面只回掩码；调用走本机后端代理，消耗你自己的模型额度</p>
        </div>
      </template>
      <NForm label-placement="top" class="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <NFormItem label="提供商" label-class="text-xs text-ink-2">
          <NSelect
            v-model:value="aiProviderId"
            :options="providerOptions"
            @update:value="syncAiForm"
          />
        </NFormItem>
        <NFormItem label="模型名" label-class="text-xs text-ink-2">
          <NInput
            v-model:value="aiModel"
            placeholder="如 doubao-seed-1-6 / deepseek-chat"
            spellcheck="false"
            :status="aiErrors.model ? 'error' : undefined"
            @input="aiErrors.model = false"
          />
        </NFormItem>
        <NFormItem label="baseUrl" label-class="text-xs text-ink-2">
          <NInput
            v-model:value="aiBaseUrl"
            placeholder="https://…/v1"
            spellcheck="false"
            :status="aiErrors.baseUrl ? 'error' : undefined"
            @input="aiErrors.baseUrl = false"
          />
        </NFormItem>
        <NFormItem :label="`API Key${providers.find((p) => p.id === aiProviderId)?.hasKey ? '（已保存，留空则不变）' : ''}`" label-class="text-xs text-ink-2">
          <NInput
            v-model:value="aiKey"
            type="password"
            show-password-on="click"
            :placeholder="providers.find((p) => p.id === aiProviderId)?.keyMask ?? '粘贴你的 Key'"
            spellcheck="false"
            :status="aiErrors.key ? 'error' : undefined"
            @input="aiErrors.key = false"
          />
        </NFormItem>
      </NForm>
      <div class="flex items-center gap-2 flex-wrap">
        <NButton type="primary" :loading="aiSaving" @click="saveAi">保存</NButton>
        <NButton secondary :loading="aiTesting" @click="testAi">测试连通（消耗一次额度）</NButton>
        <span class="ml-auto text-xs text-ink-3">Key 不入库、不进日志；换机器需重新配置</span>
      </div>
      <p v-if="aiReply" class="m-0 mt-3 text-xs text-ink-2 break-words">模型回复：{{ aiReply }}</p>
    </NCard>

    <NCard>
      <template #header>
        <div class="min-w-0">
          <h2 class="m-0 text-base font-semibold text-ink truncate">后端连接</h2>
          <p class="m-0 mt-1 text-xs text-ink-2">地址与访问密钥记在浏览器本地，未开启鉴权时密钥留空</p>
        </div>
      </template>
      <NForm label-placement="top" class="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <NFormItem label="后端地址" label-class="text-xs text-ink-2">
          <NInput
            v-model:value="origin"
            placeholder="http://127.0.0.1:5599"
            spellcheck="false"
            :status="originError ? 'error' : undefined"
            @input="originError = false"
          />
        </NFormItem>
        <NFormItem label="访问密钥（可选）" label-class="text-xs text-ink-2">
          <NInput
            v-model:value="accessKey"
            type="password"
            show-password-on="click"
            placeholder="后端未开启鉴权时留空"
            spellcheck="false"
          />
        </NFormItem>
      </NForm>

      <div class="flex items-center gap-2 flex-wrap">
        <NButton secondary :loading="testing" @click="testConnection">测试连接</NButton>
        <NButton type="primary" :disabled="testing" @click="saveConnection">保存</NButton>
        <NButton secondary :disabled="testing" @click="resetConnection">恢复默认</NButton>
        <span class="ml-auto text-xs text-ink-3">未配置鉴权时，访问密钥留空</span>
      </div>

      <div class="mt-3 flex flex-col gap-1 text-xs text-ink-3 leading-5">
        <div>后端未启动时，在工程根目录运行 <span class="font-mono text-ink-2">pnpm dev:server</span>，默认监听 127.0.0.1:5599。</div>
        <div>健康检查：<span class="font-mono text-ink-2">/api/v1/health</span>；地址与访问密钥仅记在当前浏览器本地。</div>
      </div>
    </NCard>
  </div>
</template>

