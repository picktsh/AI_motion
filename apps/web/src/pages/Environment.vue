<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NButton, NInput, NForm, NFormItem, useMessage } from 'naive-ui';
import { getEnvironment } from '../api/environment';
import { pingHealth } from '../api/health';
import { useFetch } from '../composables/useFetch';
import { useServerConfig } from '../composables/useServerConfig';
import SectionCard from '../components/data/SectionCard.vue';
import StatusTag from '../components/data/StatusTag.vue';
import SkeletonBlock from '../components/data/SkeletonBlock.vue';
import EmptyState from '../components/data/EmptyState.vue';
import PathCopy from '../components/data/PathCopy.vue';
import type { EnvItem } from '../shared/types';

const { data, loading, error, run } = useFetch(() => getEnvironment());

onMounted(run);

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
  { title: '浏览器', keys: ['chrome'] },
  { title: '工程依赖', keys: ['nodeDeps', 'pythonVenv', 'binTools'] },
];

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
    <SectionCard title="后端连接" subtitle="地址与访问密钥记在浏览器本地，未开启鉴权时密钥留空">
      <NForm label-placement="top" class="flex flex-col gap-3">
        <NFormItem label="后端地址" label-class="text-xs text-ink-2">
          <NInput
            v-model:value="origin"
            placeholder="http://127.0.0.1:5199"
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

      <div class="flex items-center gap-2 mt-3">
        <NButton secondary :loading="testing" @click="testConnection">测试连接</NButton>
        <NButton type="primary" :disabled="testing" @click="saveConnection">保存</NButton>
        <NButton secondary :disabled="testing" @click="resetConnection">恢复默认</NButton>
      </div>

      <div class="mt-3 flex flex-col gap-1 text-xs text-ink-3 leading-5">
        <div>后端未启动时，在工程根目录运行 <span class="font-mono text-ink-2">pnpm dev:server</span>，默认监听 127.0.0.1:5199。</div>
        <div>健康检查：<span class="font-mono text-ink-2">/api/v1/health</span>；下方清单列出本机依赖就位情况，缺项按提示补齐。</div>
      </div>
    </SectionCard>

    <EmptyState v-if="error" tone="danger" :description="error" tip="环境信息加载失败">
      <template #action>
        <n-button type="primary" @click="run">重试</n-button>
      </template>
    </EmptyState>

    <div v-else-if="loading">
      <SkeletonBlock :rows="4" />
    </div>

    <template v-else-if="data">
      <SectionCard>
        <div class="flex flex-col gap-3">
          <div class="flex items-baseline justify-between">
            <span class="text-sm text-ink-2">依赖就位</span>
            <span class="text-xl font-semibold text-ink num">{{ summary.ok }} / {{ summary.total }}</span>
          </div>
          <div class="h-1.5 rounded-full bg-divider overflow-hidden">
            <div
              class="h-full rounded-full transition-[width] duration-150"
              :class="summary.ok === summary.total ? 'bg-success' : 'bg-warning'"
              :style="{ width: `${Math.round(progress * 100)}%` }"
            />
          </div>
          <StatusTag
            :status="summary.ok === summary.total ? 'success' : 'danger'"
            :text="summary.ok === summary.total ? '全部就位' : '有待补齐'"
          />
        </div>
      </SectionCard>

      <div v-for="g in groups" :key="g.title" class="flex flex-col gap-4">
        <SectionCard :title="g.title">
          <div class="flex flex-col">
            <div
              v-for="item in g.items"
              :key="item.key"
              class="flex flex-col gap-2 py-2 border-b border-divider last:border-b-0"
              :class="!item.ok ? 'p-3 border border-danger rounded-control bg-danger-soft' : ''"
            >
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full flex-none" :class="item.ok ? 'bg-success' : 'bg-danger'" />
                <span class="text-sm font-medium text-ink">{{ item.label }}</span>
                <span class="text-xs text-ink-2 num">{{ item.version || '—' }}</span>
                <StatusTag
                  :status="item.ok ? 'success' : 'danger'"
                  :text="item.ok ? '就位' : '缺失'"
                />
              </div>
              <div class="pl-4">
                <PathCopy :path="item.path || '—'" inline />
              </div>
              <div v-if="!item.ok && item.hint" class="flex items-center gap-2 pl-4 text-xs text-danger">
                <span class="flex-none text-ink-3">提示</span>
                <PathCopy :path="item.hint" inline />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <EmptyState v-if="!items.length" description="未检测到环境项" />
    </template>
  </div>
</template>

