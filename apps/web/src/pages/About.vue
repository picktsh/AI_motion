<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NProgress, NTag, NSkeleton, NEmpty, NButton } from 'naive-ui';
import { useRouter } from 'vue-router';
import { getRoadmap, type RoadmapPayload } from '../api/about';
import { getRuntimeConfig } from '../api/runtime';
import type { RuntimeReport } from '../shared/types';
import { REPO_URL } from '../shared/constants';
import { useServerConfig } from '../composables/useServerConfig';
import { APP_VERSION } from '../shared/appMeta';

const { state } = useServerConfig();
const serverOrigin = state.origin;
const router = useRouter();

// 路线图来自后端解析 docs/roadmap.md，页面不另存一份阶段数据。
const roadmap = ref<RoadmapPayload | null>(null);
const roadmapLoading = ref(true);

onMounted(async () => {
  try {
    roadmap.value = await getRoadmap();
  } catch {
    roadmap.value = null;
  } finally {
    roadmapLoading.value = false;
  }
});

const percent = (done: number, total: number): number => (total ? Math.round((done / total) * 100) : 0);

// 架构拓扑只渲染 GET /config 的单一来源，不另抄一份端口与白名单。
const runtime = ref<RuntimeReport | null>(null);

onMounted(async () => {
  try {
    runtime.value = await getRuntimeConfig();
  } catch {
    runtime.value = null;
  }
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <NCard title="关于我们">
      <p class="m-0 mb-2 text-sm leading-5 text-ink-2">
        AI Motion Desk 是围绕 .motion 模板构建的本地可视化工作台，用来整理素材与作品、检查环境依赖，并衔接外部 AI 创作流程。
      </p>
      <p class="m-0 mb-2 text-sm leading-5 text-ink-2">
        本项目独立维护，与 MotionGit 无隶属、合作或官方背书关系。面板以本地磁盘文件为事实来源，支持通过面板管理文件，也支持外部 AI 工具直接将结果写入工程目录。
      </p>
      <ul class="m-0 pl-4 flex flex-col gap-1 text-sm text-ink list-disc">
        <li>前端：Vue 3.5 + Vite 6 + TypeScript + Naive UI + UnoCSS</li>
        <li>后端：Node.js + Fastify 5 + TypeScript，只读回显 + 白名单命令台任务执行</li>
        <li>安全：服务仅绑定本机回环地址，资源访问限 studio 白名单目录</li>
      </ul>
    </NCard>


    <NCard title="阶段路线图">
      <template #header-extra>
        <span v-if="roadmap" class="text-xs text-ink-3 num">完成 {{ roadmap.done }}/{{ roadmap.total }}</span>
      </template>
      <NSkeleton v-if="roadmapLoading" text :repeat="4" />
      <NEmpty v-else-if="!roadmap || !roadmap.sections.length" description="路线图文档暂不可读" />
      <div v-else class="flex flex-col gap-5">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs text-ink-3">
            <span>整体进度</span>
            <span class="num">{{ percent(roadmap.done, roadmap.total) }}%</span>
          </div>
          <NProgress type="line" :percentage="percent(roadmap.done, roadmap.total)" :show-indicator="false" :height="8" />
        </div>

        <section v-for="section in roadmap.sections" :key="section.title" class="flex flex-col gap-2">
          <div class="row-between gap-3">
            <h3 class="m-0 text-sm font-semibold text-ink">{{ section.title }}</h3>
            <span class="text-xs text-ink-3 num">{{ section.done }}/{{ section.total }}</span>
          </div>
          <NProgress type="line" :percentage="percent(section.done, section.total)" :show-indicator="false" :height="4" />
          <ul class="m-0 pl-0 flex flex-col gap-1.5 list-none">
            <li v-for="item in section.items" :key="item.text" class="flex items-start gap-2 text-sm">
              <span
                class="mt-1.5 w-1.5 h-1.5 rounded-full flex-none"
                :class="item.done ? 'bg-success' : 'bg-ink-3/40'"
              ></span>
              <span class="min-w-0 flex-1 leading-5" :class="item.done ? 'text-ink-3' : 'text-ink'">{{ item.text }}</span>
              <NTag v-if="item.done" size="small" type="success" :bordered="false" class="flex-none">已完成</NTag>
            </li>
          </ul>
        </section>

        <div class="row-between text-xs text-ink-3">
          <span>口径来源：{{ roadmap.source }} · {{ new Date(roadmap.updatedAt).toLocaleDateString('zh-CN') }}</span>
          <NButton text type="primary" @click="router.push('/environment')">运行配置看环境页</NButton>
        </div>
      </div>
    </NCard>


    <NCard title="服务架构">
      <NSkeleton v-if="!runtime" text :repeat="3" />
      <div v-else class="flex flex-col gap-4">
        <div class="flex flex-wrap items-stretch gap-3">
          <div class="arch-box">
            <span class="arch-title">浏览器面板</span>
            <span class="arch-meta">Vue 3 · 哈希路由</span>
          </div>
          <div class="arch-arrow">/api/v1 →</div>
          <div class="arch-box">
            <span class="arch-title">本机后端</span>
            <span class="arch-meta font-mono">{{ runtime.origin }}</span>
            <span class="arch-meta">{{ runtime.loopbackOnly ? '仅回环地址' : '非回环监听' }}</span>
          </div>
          <div class="arch-arrow">→</div>
          <div class="arch-box">
            <span class="arch-title">白名单目录</span>
            <span class="arch-meta">{{ runtime.paths.read.length }} 个可读 · {{ runtime.paths.write.length }} 个可写</span>
            <span class="arch-meta">{{ runtime.paths.watch.length }} 个监听根（SSE 变更域）</span>
          </div>
        </div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 text-xs text-ink-3">
          <div class="arch-note">任务并发 · 渲染 {{ runtime.jobs.renderConcurrency }} / 普通 {{ runtime.jobs.defaultConcurrency }}</div>
          <div class="arch-note">文本上限 · 读 {{ Math.round(runtime.textLimits.readBytes / 1024) }}KB / 写 {{ Math.round(runtime.textLimits.writeBytes / 1024) }}KB</div>
          <div class="arch-note">鉴权 · {{ runtime.auth.enabled ? `已启用（${runtime.auth.keyCount} 把）` : '未启用' }}</div>
          <div class="arch-note">配置来源 · {{ runtime.configFile ? '环境变量 + 本地文件' : '环境变量 / 内置缺省' }}</div>
        </div>
        <p class="m-0 text-xs text-ink-3">重动作（渲染、配音、封面）走命令台任务，面板只观测进度与产物；外部 AI 通过文件读写接口回写。</p>
      </div>
    </NCard>

    <NCard title="基本信息">
      <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <div class="flex items-center gap-2 text-sm py-1">
          <span class="flex-none text-ink-3">版本:</span>
          <span class="text-ink num">v{{ APP_VERSION }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm py-1">
          <span class="flex-none text-ink-3">后端服务:</span>
          <span class="text-ink font-mono break-all">{{ serverOrigin }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm py-1">
          <span class="flex-none text-ink-3">仓库:</span>
          <a class="text-brand no-underline break-all hover:underline" :href="REPO_URL" target="_blank" rel="noopener noreferrer">{{ REPO_URL }}</a>
        </div>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.arch-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 160px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-neutral-soft, transparent);
}
.arch-title {
  font-size: 13px;
  font-weight: 600;
}
.arch-meta {
  font-size: 11px;
  opacity: 0.7;
}
.arch-arrow {
  align-self: center;
  font-size: 12px;
  opacity: 0.6;
}
.arch-note {
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--color-neutral-soft, transparent);
}
</style>
