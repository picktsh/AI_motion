import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { config } from './config.js';

let app: FastifyInstance | null = null;

async function start(): Promise<void> {
  app = await buildApp();
  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info(`[${config.service}] 后端已启动: http://${config.host}:${config.port}${config.apiPrefix}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app?.log.info(`[${config.service}] 收到 ${signal}，正在关闭`);
  try {
    await app?.close();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

void start();
