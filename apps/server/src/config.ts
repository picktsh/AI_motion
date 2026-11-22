// 运行配置：读取环境变量并给缺省值；业务代码不从裸环境变量取配置。
import { DEFAULT_API_PREFIX, SERVICE_NAME } from '@ai-motion/shared/constants';

export interface AppConfig {
  host: string;
  port: number;
  apiPrefix: string;
  service: string;
  /** 允许的跨域来源白名单；为空表示不放开跨域（前端经 Vite 代理同源访问）。 */
  corsOrigins: string[];
  /** 可选访问密钥；未配置时不强制鉴权（回环本地默认）。 */
  accessKey: string | null;
  job: {
    defaultTimeoutMs: number;
    renderTimeoutMs: number;
    maxRetained: number;
    logCapacity: number;
    renderConcurrency: number;
    defaultConcurrency: number;
  };
}

const DEFAULTS = {
  host: '127.0.0.1',
  port: 5199,
  apiPrefix: DEFAULT_API_PREFIX,
  service: SERVICE_NAME,
};

function readPort(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : DEFAULTS.port;
}

function readOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export const config: AppConfig = {
  host: process.env.HOST || DEFAULTS.host,
  port: readPort(process.env.PORT),
  apiPrefix: (process.env.API_PREFIX || DEFAULTS.apiPrefix).replace(/\/+$/, ''),
  service: process.env.SERVICE_NAME || DEFAULTS.service,
  corsOrigins: readOrigins(process.env.CORS_ORIGINS),
  accessKey: process.env.ACCESS_KEY?.trim() || null,
  job: {
    defaultTimeoutMs: 120_000,
    renderTimeoutMs: 600_000,
    maxRetained: 50,
    logCapacity: 2_000,
    renderConcurrency: 1,
    defaultConcurrency: 2,
  },
};
