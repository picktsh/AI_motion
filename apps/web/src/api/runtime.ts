import { getJson } from './client';
import { endpoints } from './endpoints';
import type { RuntimeReport } from '../shared/types';

/** 运行配置只读视图：监听、鉴权、白名单与任务限额。 */
export function getRuntimeConfig(): Promise<RuntimeReport> {
  return getJson<RuntimeReport>(endpoints.config);
}
