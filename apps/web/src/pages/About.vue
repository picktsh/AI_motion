<script setup lang="ts">
import SectionCard from '../components/data/SectionCard.vue';
import { REPO_URL } from '../shared/constants';
import { useServerConfig } from '../composables/useServerConfig';

const VERSION = '0.1.0';
const { state } = useServerConfig();
const serverOrigin = state.origin;
</script>

<template>
  <div class="flex flex-col gap-4">
    <SectionCard title="关于我们">
      <p class="m-0 mb-2 text-sm leading-5 text-ink-2">
        AI Motion Studio 是本地 AI 视频制作工作台的图形控制台，用来浏览模板与素材、检查环境依赖、回显预览与产物。
      </p>
      <p class="m-0 mb-2 text-sm leading-5 text-ink-2">
        MotionGit（.motion）提供底层模板与渲染能力，本控制台负责可视化操作和标准化 API 调用，不在文件系统上手工蛮干。
      </p>
      <ul class="m-0 pl-4 flex flex-col gap-1 text-sm text-ink list-disc">
        <li>前端：Vue 3.5 + Vite 6 + TypeScript + Naive UI + UnoCSS</li>
        <li>后端：Node.js + Fastify 5 + TypeScript，只读回显 + 白名单命令台任务执行</li>
        <li>安全：服务仅绑定本机回环地址，资源访问限 studio 白名单目录</li>
      </ul>
    </SectionCard>

    <SectionCard title="基本信息">
      <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <div class="flex items-center gap-2 text-sm py-1">
          <span class="flex-none text-xs text-ink-3 w-16">版本</span>
          <span class="text-ink num">v{{ VERSION }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm py-1">
          <span class="flex-none text-xs text-ink-3 w-16">后端服务</span>
          <span class="text-ink font-mono break-all">{{ serverOrigin }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm py-1">
          <span class="flex-none text-xs text-ink-3 w-16">仓库</span>
          <a class="text-brand no-underline break-all hover:underline" :href="REPO_URL" target="_blank" rel="noopener noreferrer">{{ REPO_URL }}</a>
        </div>
      </div>
    </SectionCard>
  </div>
</template>
