import { getJson, getList, postForm } from './client';
import { endpoints } from './endpoints';
import type {
  TemplateSummary,
  TemplateDetail,
  CatalogPayload,
  CatalogItem,
  TemplateImportResult,
} from '../shared/types';

/** 模板卡片列表。 */
export function listTemplates(): Promise<TemplateSummary[]> {
  return getList<TemplateSummary>(endpoints.templates.list);
}

/** 模板中心公开清单；refresh=true 跳过 12 小时缓存。 */
export async function getCatalog(refresh = false): Promise<CatalogPayload> {
  const path = refresh ? `${endpoints.templates.catalog}?refresh=1` : endpoints.templates.catalog;
  const data = await getJson<{
    items: CatalogItem[];
    meta: {
      total: number;
      fetchedAt?: string;
      source?: string | null;
      stale?: boolean;
      error?: string | null;
    };
  }>(path);
  return {
    items: data.items,
    fetchedAt: data.meta.fetchedAt ?? '',
    source: data.meta.source ?? null,
    stale: Boolean(data.meta.stale),
    error: data.meta.error ?? null,
  };
}

/** 上传 .motion 包；回调给出上传百分比（0-100）。 */
export function importTemplate(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<TemplateImportResult> {
  const form = new FormData();
  form.append('file', file, file.name);
  return postForm<TemplateImportResult>(endpoints.templates.import, form, onProgress);
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
