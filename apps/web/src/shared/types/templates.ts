export interface TemplateSummary {
  id: string;
  slug: string;
  name: string;
  version: string | null;
  origin: string;
  localPath: string;
  runtime: { profile: string | null; entry: string | null };
  license: string | null;
  network: boolean | null;
  inPlace: boolean;
  /** 对应的模板中心仓库编号（来自 motion.json extensions），用于关联封面。 */
  sourceRepo: string | null;
  importedAt: string | null;
  packageSha256: string | null;
  integrity: string | null;
  integritySource: string | null;
  fileCount: number | null;
  templateId: number | null;
  packageProfile: string | null;
  specVersion: string | null;
  layout: string | null;
  hasPersonalKey: boolean;
  contentProtection: string | null;
  paidCloud: boolean;
  cloudOrigin: string | null;
}

export interface FileNode {
  name: string;
  type: 'dir' | 'file';
  size: number | null;
  children: FileNode[];
}

/** 参数概要字段（一层只读摘要）。 */
export interface ParamField {
  name: string;
  type: string | null;
  required: boolean;
  enum: string[] | null;
  constValue: string | null;
  defaultValue: unknown;
  range: string | null;
  description: string | null;
  nested: number | null;
}

export interface ParamSummary {
  file: string | null;
  fields: ParamField[];
}

export interface TemplateDetail {
  id: string;
  slug: string;
  name: string;
  version: string | null;
  origin: string;
  localPath: string;
  runtime: { profile?: string | null; entry?: string | null; [k: string]: unknown };
  lock: Record<string, unknown> | null;
  license: { file: string | null; present: boolean };
  network: boolean | null;
  output: Record<string, unknown> | null;
  permissions: Record<string, unknown> | null;
  extensions: Record<string, unknown> | null;
  parameters: ParamSummary;
  fileTree: FileNode[];
  sourceRepo: string | null;
  importedAt: string | null;
  packageSha256: string | null;
  integrity: string | null;
  integritySource: string | null;
  fileCount: number | null;
  templateId: number | null;
  packageProfile: string | null;
  specVersion: string | null;
  layout: string | null;
  hasPersonalKey: boolean;
  contentProtection: string | null;
  paidCloud: boolean;
  cloudOrigin: string | null;
}

/** 模板中心公开清单条目（motiontemplates/all catalog.json 归一后的一层结构）。 */
export interface CatalogItem {
  templateId: number;
  repositoryId: string | null;
  name: string;
  nameEn: string | null;
  summary: string | null;
  summaryEn: string | null;
  orientation: 'landscape' | 'portrait';
  ratio: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  version: string | null;
  group: string | null;
  poster: string | null;
  demo: string | null;
  website: string | null;
  repository: string | null;
  downloadType: string | null;
  downloadUrl: string | null;
  availability: string | null;
  materials: string | null;
  openSource: boolean | null;
}

export interface CatalogPayload {
  items: CatalogItem[];
  fetchedAt: string;
  source: string | null;
  stale: boolean;
  error: string | null;
}

/** 导入结果：包 sha256、完整性校验情况与落地路径。 */
export interface TemplateImportResult {
  id: string;
  slug: string;
  name: string;
  version: string | null;
  localPath: string;
  fileCount: number;
  bytes: number;
  packageSha256: string;
  integrity: 'verified' | 'absent';
  integritySource: string | null;
  verifiedFiles: number;
  packageProfile: string | null;
  specVersion: string | null;
  layout: 'legacy' | 'personal';
  hasPersonalKey: boolean;
  contentProtection: string | null;
  templateId: number | null;
  output: { width: number | null; height: number | null; layout: string | null } | null;
  sourceFilename: string;
  importedAt: string;
}
