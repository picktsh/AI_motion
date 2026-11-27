// 运行配置：环境变量 > 本地配置文件 config/local.json > 内置缺省；业务代码不从裸环境变量取配置。
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_API_PREFIX, SERVICE_NAME } from '@ai-motion/shared/constants';
import { ROOT } from './infra/paths.js';

/** 配置项来源：环境变量 / 本地配置文件 / 内置缺省。 */
export type ConfigSource = 'env' | 'file' | 'default';

export interface AppConfig {
  host: string;
  port: number;
  apiPrefix: string;
  service: string;
  /** 允许的跨域来源白名单；为空表示不放开跨域（前端 dev 跨端口直连走回环白名单）。 */
  corsOrigins: string[];
  /** 可选访问密钥集合；为空表示不强制鉴权。支持配置新旧两把用于轮换。 */
  accessKeys: string[];
  /** 每项生效值的来源，供页面标注。 */
  provided: {
    host: ConfigSource;
    port: ConfigSource;
    apiPrefix: ConfigSource;
    corsOrigins: ConfigSource;
    accessKeys: ConfigSource;
  };
  /** 实际读取到的本地配置文件绝对路径；未提供为 null。 */
  localFile: string | null;
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
  port: 5599,
  apiPrefix: DEFAULT_API_PREFIX,
  service: SERVICE_NAME,
};

// 本地配置文件：不进库（.gitignore 已忽略 config/local.json），只用于本机固定地址、端口与密钥。
const LOCAL_FILE = path.join(ROOT, 'config', 'local.json');

interface LocalSettings {
  host?: string;
  port?: number;
  apiPrefix?: string;
  corsOrigins?: string[];
  accessKeys?: string[];
}

function readLocalSettings(): { values: LocalSettings; file: string | null } {
  if (!fs.existsSync(LOCAL_FILE)) return { values: {}, file: null };
  try {
    const raw = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8')) as Record<string, unknown>;
    const values: LocalSettings = {};
    if (typeof raw.host === 'string' && raw.host.trim()) values.host = raw.host.trim();
    if (typeof raw.port === 'number') values.port = raw.port;
    if (typeof raw.apiPrefix === 'string' && raw.apiPrefix.trim()) values.apiPrefix = raw.apiPrefix.trim();
    if (Array.isArray(raw.corsOrigins)) {
      values.corsOrigins = raw.corsOrigins.filter((o): o is string => typeof o === 'string' && Boolean(o.trim()));
    }
    if (Array.isArray(raw.accessKeys)) {
      values.accessKeys = raw.accessKeys.filter((k): k is string => typeof k === 'string' && Boolean(k.trim()));
    } else if (typeof raw.accessKey === 'string' && raw.accessKey.trim()) {
      values.accessKeys = [raw.accessKey.trim()];
    }
    return { values, file: LOCAL_FILE };
  } catch {
    // 配置文件坏格式直接忽略，回落环境变量与缺省，启动不因配置写坏而失败。
    return { values: {}, file: null };
  }
}

function readPort(raw: number | string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

function readOrigins(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.split(',');
  return list.map((s) => s.trim()).filter(Boolean);
}

function splitKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((k) => k.trim()).filter(Boolean);
}

const local = readLocalSettings();

const envHost = process.env.HOST?.trim() || undefined;
const envPort = process.env.PORT;
const envPrefix = process.env.API_PREFIX;
const envOrigins = process.env.CORS_ORIGINS;
const envKeys = [...splitKeys(process.env.ACCESS_KEYS), ...splitKeys(process.env.ACCESS_KEY)];

const accessKeys = [...new Set(envKeys.length ? envKeys : local.values.accessKeys ?? [])];
const accessKeySource: ConfigSource = envKeys.length ? 'env' : local.values.accessKeys?.length ? 'file' : 'default';

export const config: AppConfig = {
  host: envHost ?? local.values.host ?? DEFAULTS.host,
  port: readPort(envPort ?? local.values.port, DEFAULTS.port),
  apiPrefix: (envPrefix || local.values.apiPrefix || DEFAULTS.apiPrefix).replace(/\/+$/, ''),
  service: process.env.SERVICE_NAME || DEFAULTS.service,
  corsOrigins: readOrigins(envOrigins || local.values.corsOrigins),
  accessKeys,
  provided: {
    host: envHost ? 'env' : local.values.host ? 'file' : 'default',
    port: envPort !== undefined ? 'env' : local.values.port !== undefined ? 'file' : 'default',
    apiPrefix: envPrefix ? 'env' : local.values.apiPrefix ? 'file' : 'default',
    corsOrigins: envOrigins ? 'env' : local.values.corsOrigins?.length ? 'file' : 'default',
    accessKeys: accessKeySource,
  },
  localFile: local.file,
  job: {
    defaultTimeoutMs: 120_000,
    renderTimeoutMs: 600_000,
    maxRetained: 50,
    logCapacity: 2_000,
    renderConcurrency: 1,
    defaultConcurrency: 2,
  },
};
