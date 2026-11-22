import { getJson, getList } from './client';
import { endpoints } from './endpoints';
import type { TemplateSummary, TemplateDetail } from '../shared/types';

/** 模板卡片列表。 */
export function listTemplates(): Promise<TemplateSummary[]> {
  return getList<TemplateSummary>(endpoints.templates.list);
}

/** 模板详情：清单、许可、运行时、文件树。 */
export function getTemplateDetail(id: string): Promise<TemplateDetail> {
  return getJson<TemplateDetail>(endpoints.templates.detail(id));
}

/** 原站跳转地址；无可用地址时返回 null。 */
export function getTemplateRedirect(
  id: string,
): Promise<{ redirectUrl: string | null }> {
  return getJson<{ redirectUrl: string | null }>(endpoints.templates.redirect(id));
}
