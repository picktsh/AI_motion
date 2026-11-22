// 运行配置：读取环境变量并给缺省值；业务代码不从裸环境变量取配置。
import { DEFAULT_API_PREFIX, SERVICE_NAME } from '@ai-motion/shared/constants';

export interface AppConfig {
  host: string;
  port: number;
  apiPrefix: string;
  service: string;
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

export const config: AppConfig = {
  host: process.env.HOST || DEFAULTS.host,
  port: readPort(process.env.PORT),
  apiPrefix: (process.env.API_PREFIX || DEFAULTS.apiPrefix).replace(/\/+$/, ''),
  service: process.env.SERVICE_NAME || DEFAULTS.service,
};
