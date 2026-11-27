import fastify, { type FastifyInstance } from 'fastify';
import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import swagger from '@fastify/swagger';
import multipart from '@fastify/multipart';
import scalarApiReference from '@scalar/fastify-api-reference';
import { config } from './config.js';
import { registerErrorHandlers } from './core/errors.js';
import { registerCors, registerAuthGuard } from './core/security.js';
import { registerHealth } from './routes/health.js';
import { registerEnvironment } from './routes/environment.js';
import { registerTemplates } from './routes/templates.js';
import { registerVideos } from './routes/videos.js';
import { registerWorks } from './routes/works.js';
import { registerBgm } from './routes/bgm.js';
import { registerAbout } from './routes/about.js';
import { registerSearch } from './routes/search.js';
import { registerAi } from './routes/ai.js';
import { registerPublish } from './routes/publish.js';
import { registerTts } from './routes/tts.js';
import { registerJobs } from './routes/jobs.js';
import { registerAssets } from './routes/assets.js';
import { registerProjects } from './routes/projects.js';
import { registerObservatory } from './routes/observatory.js';
import { registerFiles } from './routes/files.js';
import { registerRuntime } from './routes/config.js';

// 装配 Fastify 实例：插件、错误收口、文档与路由挂载。启停逻辑在 index.ts。
export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } })
    .withTypeProvider<JsonSchemaToTsProvider>();

  registerErrorHandlers(app);

  await registerCors(app);
  registerAuthGuard(app);

  // .motion 模板包上传：单文件、上限 500MB；只接收 multipart，不影响其它 JSON 路由。
  await app.register(multipart, {
    limits: { files: 1, fileSize: 500 * 1024 * 1024, fields: 8 },
  });

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
        { name: 'environment', description: '运行环境就位检查与运行配置' },
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
  registerWorks(app, config.apiPrefix);
  registerBgm(app, config.apiPrefix);
  registerAbout(app, config.apiPrefix);
  registerSearch(app, config.apiPrefix);
  registerAi(app, config.apiPrefix);
  registerProjects(app, config.apiPrefix);
  registerPublish(app, config.apiPrefix);
  registerTts(app, config.apiPrefix);
  registerJobs(app, config.apiPrefix);
  registerAssets(app, config.apiPrefix);
  registerObservatory(app, config.apiPrefix);
  registerFiles(app, config.apiPrefix);
  registerRuntime(app, config.apiPrefix);

  return app;
}
