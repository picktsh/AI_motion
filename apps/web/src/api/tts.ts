import { getList } from './client';
import { endpoints } from './endpoints';
import type { Sample, Segment } from '../shared/types';

/** 音色试音样例清单。 */
export function listSamples(): Promise<Sample[]> {
  return getList<Sample>(endpoints.tts.samples);
}

/** 配音分段与词边界清单。 */
export function listSegments(): Promise<Segment[]> {
  return getList<Segment>(endpoints.tts.segments);
}
