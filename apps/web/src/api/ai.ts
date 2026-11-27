import { getJson, putJson, postJson } from './client';
import { endpoints } from './endpoints';

export interface AiProviderView {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  keyMask: string | null;
  updatedAt: string | null;
}

export interface AiChatResult {
  providerId: string;
  model: string;
  text: string;
  usage: Record<string, unknown> | null;
}

/** 提供商列表：Key 只回掩码。 */
export async function listAiProviders(): Promise<AiProviderView[]> {
  const data = await getJson<{ items: AiProviderView[] }>(endpoints.ai.providers);
  return data.items;
}

export function saveAiProvider(
  id: string,
  body: { baseUrl?: string; model?: string; apiKey?: string },
): Promise<AiProviderView> {
  return putJson<AiProviderView>(endpoints.ai.provider(id), body);
}

/** 走本机后端代理，消耗用户本人模型额度。 */
export function aiChat(providerId: string, content: string): Promise<AiChatResult> {
  return postJson<AiChatResult>(endpoints.ai.chat, {
    providerId,
    messages: [{ role: 'user', content }],
  });
}
