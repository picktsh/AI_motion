import type { Component } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import {
  HomeOutline,
  CubeOutline,
  AlbumsOutline,
  FilmOutline,
  MicOutline,
  TerminalOutline,
  ConstructOutline,
} from '@vicons/ionicons5';

declare module 'vue-router' {
  interface RouteMeta {
    /** 顶栏标题 */
    title: string;
    /** 顶栏副标题 */
    description?: string;
    /** 存在则进入侧边栏菜单，值为菜单文字 */
    menu?: string;
    /** 菜单图标 */
    icon?: Component;
  }
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('./pages/Dashboard.vue'),
      meta: {
        title: '仪表盘',
        description: '本地 AI 视频制作工作台概览',
        menu: '仪表盘',
        icon: HomeOutline,
      },
    },
    {
      path: '/templates',
      name: 'templates',
      component: () => import('./pages/Templates.vue'),
      meta: {
        title: '模板',
        description: 'MotionGit .motion 模板包，含渲染入口、许可与完整文件树',
        menu: '模板',
        icon: CubeOutline,
      },
    },
    {
      path: '/works',
      name: 'works',
      component: () => import('./pages/Works.vue'),
      meta: {
        title: '作品',
        description: '发布清单：发布配置、封面与成片交付物（清单接口待落地）',
        menu: '作品',
        icon: AlbumsOutline,
      },
    },
    {
      path: '/videos',
      name: 'videos',
      component: () => import('./pages/Videos.vue'),
      meta: {
        title: '视频条目',
        description: '制作工程：输入参数、引用素材、字幕与产物回显',
        menu: '视频条目',
        icon: FilmOutline,
      },
    },
    {
      path: '/tts',
      name: 'tts',
      component: () => import('./pages/Tts.vue'),
      meta: {
        title: '配音 TTS',
        description: 'edge-tts 音色试听',
        menu: '配音 TTS',
        icon: MicOutline,
      },
    },
    {
      path: '/jobs',
      name: 'jobs',
      component: () => import('./pages/Jobs.vue'),
      meta: {
        title: '命令台',
        description: '本地任务执行：提交命令、查看状态与日志、取消任务',
        menu: '命令台',
        icon: TerminalOutline,
      },
    },
    {
      path: '/environment',
      name: 'environment',
      component: () => import('./pages/Environment.vue'),
      meta: {
        title: '环境检查',
        description: '本地依赖、媒体工具与工程目录就位情况',
        menu: '环境检查',
        icon: ConstructOutline,
      },
    },
    {
      path: '/changelog',
      name: 'changelog',
      component: () => import('./pages/Changelog.vue'),
      meta: { title: '更新日志', description: '控制台版本变更记录' },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('./pages/About.vue'),
      meta: { title: '关于我们', description: '产品定位、技术栈与安全边界' },
    },
  ],
});

export default router;
