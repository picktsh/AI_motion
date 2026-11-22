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
  fileTree: FileNode[];
}
