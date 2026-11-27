import fs from 'node:fs';
import path from 'node:path';
import { PROTOCOL_VERSION } from '@ai-motion/shared/constants';
import { config, type ConfigSource } from '../config.js';
import { ROOT, WHITELIST_DIRS, WRITABLE_DIRS, WATCH_ROOTS, TEXT_EXTS, MAX_READ_BYTES, MAX_WRITE_BYTES } from '../infra/paths.js';

// 运行配置说明：把监听地址、鉴权状态、白名单目录、任务限额集中回吐一份只读视图。
// 页面只渲染这份数据，不再各自硬编码口径；来源与缺省值跟随 config 的 provided 标记。
// 配置优先级：环境变量 > config/local.json > 内置缺省。

export interface RuntimeItem {
  key: string;
  label: string;
  value: string;
  /** env 环境变量 / file 本地配置文件 / default 内置缺省。 */
  source: ConfigSource;
  /** 对应环境变量名或配置字段名，缺省来源时为 null。 */
  origin: string | null;
  /** 该项的内置缺省值，便于对照；无缺省时为 null。 */
  fallback: string | null;
  note: string | null;
}

export interface RuntimeReport {
  service: string;
  version: string;
  /** 接口协议版本，前端用于运行时比对。 */
  protocol: string;
  origin: string;
  loopbackOnly: boolean;
  configFile: string | null;
  auth: {
    enabled: boolean;
    keyCount: number;
    /** 仅当只配一把密钥时给长度，多把时不回显任何长度。 */
    keyLength: number | null;
    header: string;
    note: string;
  };
  items: RuntimeItem[];
  paths: {
    root: string;
    read: string[];
    write: string[];
    watch: string[];
  };
  textLimits: { readBytes: number; writeBytes: number; extensions: string[] };
  jobs: { renderConcurrency: number; defaultConcurrency: number; renderTimeoutMs: number; defaultTimeoutMs: number; logCapacity: number; maxRetained: number };
}

function readVersion(): string {
  try {
    const raw = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function item(
  key: string,
  label: string,
  value: string,
  source: ConfigSource,
  origin: string | null,
  fallback: string | null,
  note: string | null = null,
): RuntimeItem {
  return { key, label, value, source, origin, fallback, note };
}

export function collectRuntime(): RuntimeReport {
  const p = config.provided;
  const loopbackOnly = config.host === '127.0.0.1' || config.host === '::1' || config.host === 'localhost';
  const keyCount = config.accessKeys.length;

  const items: RuntimeItem[] = [
    item('service', '服务名', config.service, 'default', 'SERVICE_NAME', 'ai-motion-studio'),
    item('host', '监听地址', config.host, p.host, 'HOST', '127.0.0.1', loopbackOnly ? '仅本机可访问' : '非回环地址，局域网内其它设备可访问'),
    item('port', '监听端口', String(config.port), p.port, 'PORT', '5599'),
    item('apiPrefix', '接口前缀', config.apiPrefix, p.apiPrefix, 'API_PREFIX', '/api/v1'),
    item(
      'cors',
      '跨域白名单',
      config.corsOrigins.length ? config.corsOrigins.join('，') : '未配置（仅放行本机回环来源）',
      p.corsOrigins,
      'CORS_ORIGINS',
      '未配置',
    ),
    item(
      'accessKeys',
      '访问密钥',
      keyCount ? `已启用（${keyCount} 把${keyCount === 1 ? `，长度 ${config.accessKeys[0].length}` : ''}）` : '未启用（不强制鉴权）',
      p.accessKeys,
      'ACCESS_KEY / ACCESS_KEYS',
      '未配置',
      '密钥只从环境变量或本地配置文件读取，不入库、不回显明文；多把并存可用于轮换',
    ),
    item('renderConcurrency', '渲染并发', String(config.job.renderConcurrency), 'default', null, '1', '成片渲染同时只跑一条'),
    item('defaultConcurrency', '普通任务并发', String(config.job.defaultConcurrency), 'default', null, '2'),
    item('renderTimeout', '渲染超时', `${config.job.renderTimeoutMs / 1000}s`, 'default', null, '600s'),
    item('defaultTimeout', '普通任务超时', `${config.job.defaultTimeoutMs / 1000}s`, 'default', null, '120s'),
    item('logCapacity', '任务日志上限', `${config.job.logCapacity} 行/任务`, 'default', null, '2000'),
    item('maxRetained', '任务保留数', `${config.job.maxRetained} 条`, 'default', null, '50', '任务表只在内存，重启清空'),
  ];

  return {
    service: config.service,
    version: readVersion(),
    protocol: PROTOCOL_VERSION,
    origin: `http://${config.host}:${config.port}${config.apiPrefix}`,
    loopbackOnly,
    configFile: config.localFile,
    auth: {
      enabled: keyCount > 0,
      keyCount,
      keyLength: keyCount === 1 ? config.accessKeys[0].length : null,
      header: 'x-access-key',
      note: '配置密钥后，除 /docs 与 /health 外的接口都要求携带密钥；Bearer 头同样接受',
    },
    items,
    paths: {
      root: ROOT,
      read: WHITELIST_DIRS,
      write: WRITABLE_DIRS,
      watch: WATCH_ROOTS,
    },
    textLimits: {
      readBytes: MAX_READ_BYTES,
      writeBytes: MAX_WRITE_BYTES,
      extensions: [...TEXT_EXTS],
    },
    jobs: { ...config.job },
  };
}
