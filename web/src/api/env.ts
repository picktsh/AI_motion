import { getJson } from './client';
import { endpoints } from './endpoints';
import type { EnvReport } from '../types';

/** 本地依赖、媒体工具与工程目录就位情况。 */
export function getEnvironment(): Promise<EnvReport> {
  return getJson<EnvReport>(endpoints.environment);
}
