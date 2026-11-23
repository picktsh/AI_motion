import { normalizeOrigin, type ServerConfig } from '../composables/useServerConfig';

// 探活独立于 axios 实例：看门页保存配置前，实例 baseURL 还没定型，直接 fetch 绝对地址。

const API_PREFIX = '/api/v1';

/** 探测指定后端是否可达；不抛异常，返回可读结果。 */
export async function pingHealth(
  origin: string,
  accessKey: string,
): Promise<{ ok: boolean; message: string }> {
  const base = `${normalizeOrigin(origin)}${API_PREFIX}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = accessKey.trim();
  if (key) headers['x-access-key'] = key;
  try {
    const res = await fetch(`${base}/health`, { headers });
    if (!res.ok) return { ok: false, message: `服务返回 ${res.status}` };
    const body = (await res.json()) as { ok?: boolean; error?: { message?: string } };
    if (body?.ok) return { ok: true, message: '连接成功' };
    return { ok: false, message: body?.error?.message ?? '服务状态异常' };
  } catch {
    return { ok: false, message: '无法连接，请确认后端已启动且地址正确' };
  }
}

export type { ServerConfig };
