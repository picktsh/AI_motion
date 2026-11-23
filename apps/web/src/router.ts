import type { Component } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { useServerConfig } from './composables/useServerConfig';
import {
  CreateOutline,
  FolderOpenOutline,
  HomeOutline,
  CubeOutline,
  AlbumsOutline,
  ImagesOutline,
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
    /** 子页面：顶栏显示返回按钮，值为返回路径 */
    back?: string;
    /** 看门页：不套侧边栏布局，未配置后端地址时拦截进入 */
    gate?: boolean;
  }
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/gate',
      name: 'gate',
      component: () => import('./pages/Gate.vue'),
      meta: { title: '连接后端', gate: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('./pages/Dashboard.vue'),
      meta: {
        title: '观测总览',
        description: '文件变动监测、素材与产物盘点、环境就位情况',
        menu: '总览',
        icon: HomeOutline,
      },
    },
    {
      path: '/create',
      name: 'create',
      component: () => import('./pages/CreateProject.vue'),
      meta: {
        title: '新建项目',
        description: '选模板、写文稿建立工程目录；入参调整交给外部 AI 工具',
      },
    },
    {
      path: '/assets',
      name: 'assets',
      component: () => import('./pages/Assets.vue'),
      meta: {
        title: '素材库',
        description: '工程内全部可用素材与产物，按磁盘文件回显',
        menu: '素材',
        icon: ImagesOutline,
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
      path: '/projects',
      name: 'projects',
      component: () => import('./pages/Projects.vue'),
      meta: {
        title: '项目',
        description: '每条片子的文稿、报价、生成状态与发布配置',
        menu: '项目',
        icon: FolderOpenOutline,
      },
    },
    {
      path: '/projects/:id',
      name: 'project-detail',
      component: () => import('./pages/ProjectDetail.vue'),
      meta: { title: '项目详情', description: '文稿、报价与生成进度' },
    },
    {
      path: '/works',
      name: 'works',
      component: () => import('./pages/Works.vue'),
      meta: {
        title: '作品',
        description: '已生成的成片在这里维护发布配置、封面与交付物',
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
        icon: FilmOutline,
        back: '/works',
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
        title: '任务',
        description: '本地任务执行：提交命令、查看状态与日志、取消任务',
        menu: '任务',
        icon: TerminalOutline,
      },
    },
    {
      path: '/environment',
      name: 'environment',
      component: () => import('./pages/Environment.vue'),
      meta: {
        title: '设置',
        description: '本地依赖、媒体工具与工程目录就位情况',
        menu: '设置',
        icon: ConstructOutline,
      },
    },
    {
      path: '/changelog',
      name: 'changelog',
      component: () => import('./pages/Changelog.vue'),
      meta: { title: '更新日志', description: '控制台版本变更记录', back: '/' },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('./pages/About.vue'),
      meta: { title: '关于我们', description: '产品定位、技术栈与安全边界', back: '/' },
    },
  ],
});

// 未配置后端地址时拦截到看门页；已配置后访问看门页直接回首页。
router.beforeEach((to) => {
  const { state } = useServerConfig();
  if (!state.saved && to.path !== '/gate') {
    return { path: '/gate', query: { redirect: to.fullPath } };
  }
  if (state.saved && to.path === '/gate') {
    return { path: '/' };
  }
  return true;
});

export default router;
