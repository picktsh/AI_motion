import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import UnoCSS from '@unocss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const rawPort = Number(env.VITE_PORT);
  const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536 ? rawPort : 5577;

  return {
    plugins: [vue(), UnoCSS()],
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
