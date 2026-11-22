import fastify from 'fastify';
import swagger from '@fastify/swagger';
import scalarApiReference from '@scalar/fastify-api-reference';
import { config } from './config.mjs';
import { registerErrorHandlers } from './errors.mjs';
import { registerHealth } from './routes/health.mjs';
import { registerEnvironment } from './routes/environment.mjs';
import { registerTemplates } from './routes/templates.mjs';
import { registerVideos } from './routes/videos.mjs';
import { registerTts } from './routes/tts.mjs';
import { registerAssets } from './routes/assets.mjs';

const app = fastify({ logger: false });

// CORS：本轮先保持全开放；来源白名单收紧为独立条目。
app.addHook('onRequest', (request, reply, done) => {
  reply.header('Access-Control-Allow-Origin', '*');
  if (request.method === 'OPTIONS') {
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return reply.status(204).send();
  }
  done();
});

registerErrorHandlers(app);

// OpenAPI 文档：路由 schema 生成规范；Scalar 在 /docs 渲染。
// 9.x 不再内置文档 HTTP 端点，这里手动暴露稳定的 JSON 数据源，便于 codegen 与外部导入。
await app.register(swagger, {
  openapi: {
    openapi: '3.1.0',
    info: {
      title: 'AI Motion Studio API',
      version: '0.1.0',
      description: '本地 AI 视频制作工作台后端接口；一期为只读回显。',
    },
    servers: [{ url: `http://${config.host}:${config.port}${config.apiPrefix}` }],
    tags: [
      { name: 'health', description: '服务状态' },
      { name: 'environment', description: '运行环境就位检查' },
      { name: 'templates', description: 'MotionGit 模板' },
      { name: 'videos', description: '视频条目' },
      { name: 'tts', description: '配音样例与分段' },
      { name: 'assets', description: '静态资产回显' },
    ],
  },
});

app.get('/documentation/json', { schema: { hide: true } }, () => app.swagger());

await app.register(scalarApiReference, {
  routePrefix: '/docs',
  configuration: { title: 'AI Motion Studio API' },
});

registerHealth(app, config.apiPrefix);
registerEnvironment(app, config.apiPrefix);
registerTemplates(app, config.apiPrefix);
registerVideos(app, config.apiPrefix);
registerTts(app, config.apiPrefix);
registerAssets(app, config.apiPrefix);

async function start() {
  try {
    await app.listen({ host: config.host, port: config.port });
    console.log(`[${config.service}] 后端已启动: http://${config.host}:${config.port}${config.apiPrefix}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`[${config.service}] 收到 ${signal}，正在关闭`);
  try {
    await app.close();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
