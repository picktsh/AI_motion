import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../infra/paths.js';
import { badRequest, notFound } from '../core/errors.js';

// 多家 BYOK：Key 只落本地 config/ai.json（gitignore、0600），页面只回掩码。
// 统一走 OpenAI 兼容 /chat/completions，差异厂商靠可改 baseUrl 兜住。
const FILE = path.join(ROOT, 'config', 'ai.json');

export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  updatedAt: string | null;
}

export interface AiProviderView {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  keyMask: string | null;
  updatedAt: string | null;
}

const DEFAULTS: Array<Omit<AiProvider, 'apiKey' | 'updatedAt'>> = [
  { id: 'ark', name: '火山方舟', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-1-6' },
  { id: 'qwen', name: '通义千问（兼容模式）', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'openai', name: 'OpenAI 兼容', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
];

interface Store {
  providers: Record<string, AiProvider>;
}

function read(): Store {
  const parsed = (() => {
    try {
      return JSON.parse(fs.readFileSync(FILE, 'utf8')) as Store;
    } catch {
      return null;
    }
  })();
  const providers: Record<string, AiProvider> = {};
  for (const d of DEFAULTS) {
    const saved = parsed?.providers?.[d.id];
    providers[d.id] = {
      ...d,
      baseUrl: saved?.baseUrl || d.baseUrl,
      model: saved?.model || d.model,
      apiKey: saved?.apiKey ?? '',
      updatedAt: saved?.updatedAt ?? null,
    };
  }
  return { providers };
}

function write(store: Store): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const temp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, FILE);
}

function mask(key: string): string | null {
  if (!key) return null;
  if (key.length <= 8) return `${key.slice(0, 2)}****`;
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

export function listProviders(): AiProviderView[] {
  const store = read();
  return Object.values(store.providers).map((p) => ({
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    model: p.model,
    hasKey: Boolean(p.apiKey),
    keyMask: mask(p.apiKey),
    updatedAt: p.updatedAt,
  }));
}

export function saveProvider(id: string, input: Record<string, unknown>): AiProviderView {
  const store = read();
  const provider = store.providers[id];
  if (!provider) throw notFound(`未支持的提供商：${id}`);
  const baseUrl = String(input.baseUrl ?? provider.baseUrl).trim();
  if (!/^https?:\/\//.test(baseUrl)) throw badRequest('baseUrl 必须是 http(s) 地址');
  const model = String(input.model ?? provider.model).trim();
  if (!model) throw badRequest('模型名不能为空');
  const rawKey = input.apiKey;
  const apiKey = rawKey === undefined ? provider.apiKey : String(rawKey).trim();
  const next: AiProvider = {
    ...provider,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model,
    apiKey,
    updatedAt: new Date().toISOString(),
  };
  store.providers[id] = next;
  write(store);
  return {
    id: next.id,
    name: next.name,
    baseUrl: next.baseUrl,
    model: next.model,
    hasKey: Boolean(next.apiKey),
    keyMask: mask(next.apiKey),
    updatedAt: next.updatedAt,
  };
}

export interface ChatResult {
  providerId: string;
  model: string;
  text: string;
  usage: Record<string, unknown> | null;
}

export async function chat(id: string, input: Record<string, unknown>): Promise<ChatResult> {
  const store = read();
  const provider = store.providers[id];
  if (!provider) throw notFound(`未支持的提供商：${id}`);
  if (!provider.apiKey) throw badRequest('这个提供商还没保存 Key，先到环境页填 Key');
  const messages = Array.isArray(input.messages) ? input.messages : [];
  if (!messages.length) throw badRequest('messages 不能为空');
  const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({ model: provider.model, messages, stream: false }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    throw badRequest(`请求 ${provider.name} 失败：${err instanceof Error ? err.message : '未知原因'}`);
  }
  const body = (await response.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }>; usage?: Record<string, unknown>; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw badRequest(`${provider.name} 返回 ${response.status}：${body?.error?.message ?? '未知错误'}（检查 Key、模型名与 baseUrl）`);
  }
  const text = body?.choices?.[0]?.message?.content ?? '';
  if (!text) throw badRequest('模型返回空内容');
  return { providerId: provider.id, model: provider.model, text, usage: body?.usage ?? null };
}
