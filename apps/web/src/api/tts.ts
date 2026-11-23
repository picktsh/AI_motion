import { getList } from './client';
import { endpoints } from './endpoints';
import { resolveAssetUrl } from '../composables/useServerConfig';
import type { Sample, Segment } from '../shared/types';

/** 音色试音样例清单。 */
export async function listSamples(): Promise<Sample[]> {
  const items = await getList<Sample>(endpoints.tts.samples);
  return items.map((s) => ({ ...s, url: resolveAssetUrl(s.url) }));
}

/** 配音分段与词边界清单。 */
export async function listSegments(): Promise<Segment[]> {
  const items = await getList<Segment>(endpoints.tts.segments);
  return items.map((s) => ({ ...s, url: resolveAssetUrl(s.url) }));
}
