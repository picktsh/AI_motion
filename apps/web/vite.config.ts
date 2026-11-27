import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import UnoCSS from '@unocss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const rawPort = Number(env.VITE_PORT);
  const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536 ? rawPort : 5577;

  return {
    plugins: [vue(), UnoCSS()],
    build: {
      // 组件库与渲染类库单独分包：主包只剩页面代码，组件包稳定可长期缓存。
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/naive-ui')) {
              // 表格/树/选择器等重组件单独一包，常规按钮、表单与布局进核心包。
              return /naive-ui\/es\/(data-table|table|tree|tree-select|select|pagination|virtual-list|transfer)/.test(id)
                ? 'naive-data'
                : 'naive-ui';
            }
            if (id.includes('node_modules/wavesurfer.js') || id.includes('node_modules/markdown-it')) return 'media';
            if (/node_modules\/(vue|vue-router|@vue|axios|lodash-es|@vueuse)/.test(id)) return 'vue-vendor';
            return undefined;
          },
        },
      },
    },
    server: {
      port,
      host: '127.0.0.1',
      // 后端地址改由页面运行时配置（看门页/环境页），前端直连配置的 origin，不再走 Vite 代理。
      // proxy: {
      //   [env.VITE_SERVER_API]: { target: env.VITE_SERVER_ORIGIN, changeOrigin: true },
      // },
    },
  };
});
