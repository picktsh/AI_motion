<script setup lang="ts">
import { NCard } from 'naive-ui';
import { REPO_URL } from '../shared/constants';
import { useServerConfig } from '../composables/useServerConfig';
import { APP_VERSION } from '../shared/appMeta';

const { state } = useServerConfig();
const serverOrigin = state.origin;
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
