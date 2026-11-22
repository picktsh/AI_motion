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
}
