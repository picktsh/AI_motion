// 跨域白名单与访问密钥骨架。密钥只从环境变量读取，不入库、不写日志、不回显。
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import cors from '@fastify/cors';
import { config } from '../config.js';
import { unauthorized } from './errors.js';

// 放行前缀：文档与健康探测，便于排查；其余接口在配置了密钥时强制校验。
const PUBLIC_PREFIXES = ['/docs', '/documentation/json'];

function extractKey(req: FastifyRequest): string | null {
  const header = req.headers['x-access-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

function sameKey(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** 本机回环来源：桌面前端 dev 跨端口直连属于回环，允许；公网来源不放行。 */
function isLoopbackOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    const hostname = new URL(origin).hostname;
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

// CORS：显式白名单优先；未配白名单时仅放行本机回环来源（前端 dev 跨端口直连）。
export async function registerCors(app: FastifyInstance): Promise<void> {
  const origins = config.corsOrigins;
  await app.register(cors, {
    origin: (origin, callback) => {
      const allowed = origins.length > 0 ? origins.includes(origin ?? '') : isLoopbackOrigin(origin);
      callback(null, allowed);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Access-Key'],
  });
}

// 访问密钥骨架：未配置 ACCESS_KEY 时回环本地默认不强制；配置后对业务接口强制校验。
export function registerAuthGuard(app: FastifyInstance): void {
  const expected = config.accessKey;
  if (!expected) return;

  app.addHook('preHandler', async (req: FastifyRequest) => {
    if (req.method === 'OPTIONS') return;
    if (PUBLIC_PREFIXES.some((p) => req.url.startsWith(p))) return;
    if (req.url === `${config.apiPrefix}/health`) return;

    const provided = extractKey(req);
    if (!provided || !sameKey(provided, expected)) {
      throw unauthorized('访问密钥缺失或无效');
    }
  });
}
