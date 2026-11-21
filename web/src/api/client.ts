const API_PREFIX = import.meta.env.VITE_SERVER_API;
const serverOrigin = import.meta.env.VITE_SERVER_ORIGIN;

export function apiUrl(path: string): string {
  return `${API_PREFIX}${path}`;
}

export async function getJson<T>(path: string): Promise<T> {
  const url = apiUrl(path);
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    // 直连被拒 / 网络不可达：fetch 直接抛 TypeError，没有响应
    throw new Error(`无法连接本地后端服务 ${serverOrigin}，请确认后端已启动`);
  }
  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? '';
    // 代理/网关层错误返回 text/plain，说明后端没起来；JSON 错误才是后端内部响应
    if (res.status >= 500 && !contentType.includes('application/json')) {
      throw new Error(`无法连接本地后端服务 ${serverOrigin}，请确认后端已启动`);
    }
    throw new Error(`请求失败 ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
