<script setup lang="ts">
import SectionCard from '../components/data/SectionCard.vue';
import { REPO_URL } from '../shared/constants';

const VERSION = '0.1.0';
const serverOrigin = import.meta.env.VITE_SERVER_ORIGIN;
</script>

<template>
  <div class="about-page">
    <SectionCard title="关于我们">
      <p class="about__lead">
        AI Motion Studio 是本地 AI 视频制作工作台的图形控制台，用来浏览模板与素材、检查环境依赖、回显预览与产物。
      </p>
      <p class="about__lead">
        MotionGit（.motion）提供底层模板与渲染能力，本控制台负责可视化操作和标准化 API 调用，不在文件系统上手工蛮干。
      </p>
      <ul class="about__list">
        <li>前端：Vue 3.5 + Vite 6 + TypeScript + Naive UI + UnoCSS</li>
        <li>后端：Node.js + Fastify 5 + TypeScript，只读回显 + 白名单命令台任务执行</li>
        <li>安全：服务仅绑定本机回环地址，资源访问限 studio 白名单目录</li>
      </ul>
    </SectionCard>

    <SectionCard title="基本信息">
      <div class="meta-grid">
        <div class="meta">
          <span class="meta__label">版本</span>
          <span class="meta__value tnum">v{{ VERSION }}</span>
        </div>
        <div class="meta">
          <span class="meta__label">后端服务</span>
          <span class="meta__value mono">{{ serverOrigin }}</span>
        </div>
        <div class="meta meta--link">
          <span class="meta__label">仓库</span>
          <a class="meta__link-value" :href="REPO_URL" target="_blank" rel="noopener noreferrer">{{ REPO_URL }}</a>
        </div>
      </div>
    </SectionCard>
  </div>
</template>

<style scoped>
.about-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.about__lead {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-secondary);
}

.about__list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-primary);
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 4px 0;
}

.meta__label {
  flex: none;
  font-size: 12px;
  color: var(--color-text-tertiary);
  width: 64px;
}

.meta__value {
  color: var(--color-text-primary);
}

.meta__link-value {
  color: var(--color-brand);
  text-decoration: none;
  word-break: break-all;
}

.meta__link-value:hover {
  text-decoration: underline;
}
</style>
