import fastify, { type FastifyInstance } from 'fastify';
import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import scalarApiReference from '@scalar/fastify-api-reference';
import { config } from './config.js';
import { registerErrorHandlers } from './core/errors.js';
import { registerHealth } from './routes/health.js';
import { registerEnvironment } from './routes/environment.js';
import { registerTemplates } from './routes/templates.js';
import { registerVideos } from './routes/videos.js';
import { registerTts } from './routes/tts.js';
import { registerJobs } from './routes/jobs.js';
import { registerAssets } from './routes/assets.js';

// 装配 Fastify 实例：插件、错误收口、文档与路由挂载。启停逻辑在 index.ts。
export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } })
    .withTypeProvider<JsonSchemaToTsProvider>();

  // CORS：当前保持全开放（本地单用户）；来源白名单收紧为独立安全条目。
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  registerErrorHandlers(app);

  // OpenAPI 文档：路由 schema 生成规范；Scalar 在 /docs 渲染。
  // 9.x 不再内置文档 HTTP 端点，这里手动暴露稳定 JSON 数据源，便于 codegen 与外部导入。
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'AI Motion Studio API',
        version: '0.1.0',
        description: '本地 AI 视频制作工作台后端接口；只读回显与命令台任务执行。',
      },
      servers: [{ url: `http://${config.host}:${config.port}${config.apiPrefix}` }],
      tags: [
        { name: 'health', description: '服务状态' },
        { name: 'environment', description: '运行环境就位检查' },
        { name: 'templates', description: 'MotionGit 模板' },
        { name: 'videos', description: '视频条目' },
        { name: 'tts', description: '配音样例与分段' },
        { name: 'jobs', description: '命令台任务执行与日志' },
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
  registerJobs(app, config.apiPrefix);
  registerAssets(app, config.apiPrefix);

  return app;
}
