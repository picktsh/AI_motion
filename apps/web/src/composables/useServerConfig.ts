import { reactive } from 'vue';

// 后端服务地址与访问密钥：运行时可配，存 localStorage。
// 前端是空壳，不绑死后端域名；默认本机回环，可在看门页或环境页修改。

const STORAGE_KEY = 'ams-server-config';
const API_PREFIX = '/api/v1';
const DEFAULT_ORIGIN = 'http://127.0.0.1:5599';

export interface ServerConfig {
  /** 后端基址，含协议与端口；空串表示走相对前缀（仅开发代理兜底）。 */
  origin: string;
  /** 访问密钥；后端未配置鉴权时留空。 */
  accessKey: string;
  /** 用户已在看门页确认过配置，未确认前拦截到看门页。 */
  saved: boolean;
}

function load(): ServerConfig {
  const fallback: ServerConfig = { origin: DEFAULT_ORIGIN, accessKey: '', saved: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ServerConfig>;
    return {
      origin: typeof parsed.origin === 'string' ? parsed.origin : DEFAULT_ORIGIN,
      accessKey: typeof parsed.accessKey === 'string' ? parsed.accessKey : '',
      saved: parsed.saved === true,
    };
  } catch {
    return fallback;
  }
}

const state = reactive<ServerConfig>(load());

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时仅保留内存态，不阻断使用。
  }
}

/** 规范化地址：去尾斜杠、缺协议补 http；空值回默认本机。 */
export function normalizeOrigin(raw: string): string {
  let v = raw.trim().replace(/\/+$/, '');
  if (!v) return DEFAULT_ORIGIN;
  if (!/^https?:\/\//i.test(v)) v = `http://${v}`;
  return v;
}

/** 完整接口基址：规范化 origin 拼接前缀。 */
export function baseUrl(): string {
  const origin = normalizeOrigin(state.origin);
  return `${origin}${API_PREFIX}`;
}

/** 拼一个接口的完整绝对地址（供提示词复制、静态资源直链使用）。 */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl()}${p}`;
}

/**
 * 归一后端回吐的资源地址：已是 http(s) 绝对地址原样返回；
 * 以 / 开头的相对接口路径（如 /api/v1/assets?path=...）拼上当前配置的后端 origin。
 * 空值返回 null，供媒体标签判空。
 */
export function resolveAssetUrl(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (/^https?:\/\//i.test(ref)) return ref;
  const origin = normalizeOrigin(state.origin);
  const p = ref.startsWith('/') ? ref : `/${ref}`;
  return `${origin}${p}`;
}

/** 递归把对象/数组里所有 `url` 字段的相对资源地址归一到后端 origin；非 url 字段原样保留。 */
export function normalizeAssetUrls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAssetUrls(item)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = key === 'url' && typeof v === 'string' ? resolveAssetUrl(v) : normalizeAssetUrls(v);
    }
    return out as T;
  }
  return value;
}

/** 鉴权请求头；无密钥时返回空对象。 */
export function authHeaders(): Record<string, string> {
  return state.accessKey.trim() ? { 'x-access-key': state.accessKey.trim() } : {};
}

/** 提示词共用的后端接入段：快照地址 + 鉴权说明，各业务提示词前置拼接。 */
export function backendContextLines(): string[] {
  const lines = [
    `本地后端基址：${baseUrl()}`,
    `先拉聚合快照：GET ${apiUrl('/observatory/context')}，里面有环境就位情况、各模板槽位摘要、项目台账、素材与音色盘点；先据此核对，不要重复探测环境。`,
  ];
  if (state.accessKey.trim()) {
    lines.push(`鉴权请求头：x-access-key: ${state.accessKey.trim()}`);
  } else {
    lines.push('当前后端未配置访问密钥，业务接口无需鉴权头；若返回 401，再按后端要求补 x-access-key 头。');
  }
  return lines;
}

export function useServerConfig() {
  function save(origin: string, accessKey: string): void {
    state.origin = normalizeOrigin(origin);
    state.accessKey = accessKey.trim();
    state.saved = true;
    persist();
  }

  function reset(): void {
    state.origin = DEFAULT_ORIGIN;
    state.accessKey = '';
    state.saved = false;
    persist();
  }

  return {
    state,
    apiPrefix: API_PREFIX,
    defaultOrigin: DEFAULT_ORIGIN,
    save,
    reset,
    baseUrl,
    apiUrl,
    authHeaders,
    backendContextLines,
    resolveAssetUrl,
    normalizeOrigin,
  };
}
