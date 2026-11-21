export interface EnvItem {
  key: string;
  label: string;
  ok: boolean;
  version: string | null;
  path: string | null;
  hint: string | null;
}

export interface EnvReport {
  items: EnvItem[];
  summary: { ok: number; total: number };
}

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

export interface VideoSummary {
  id: string;
  title: string;
  duration: number | null;
  layout: string | null;
  sceneCount: number;
  captionCount: number;
  videoCount: number;
  instanceCount: number;
  preview: { name: string; type: string; rel: string; url: string } | null;
}

export interface MediaRef {
  role: string;
  file: string;
  type: string;
  exists: boolean;
  url: string | null;
}

export interface ProbeResult {
  ok: boolean;
  duration?: number | null;
  size?: number | null;
  bitRate?: number | null;
  streams: { type: string; codec: string; width: number | null; height: number | null; channels: number | null; sampleRate: number | null }[];
  reason?: string;
}

export interface Artifact {
  name: string;
  type: string;
  rel: string;
  url: string;
  probe?: ProbeResult | null;
}

export interface VideoMeta {
  title?: string;
  duration?: number;
  layout?: string;
  scenes: { id: string; title: string }[];
  captions: { start: number; end: number; text: string }[];
  media?: Record<string, { file?: string; [k: string]: unknown }>;
  [k: string]: unknown;
}

export interface VideoDetail {
  id: string;
  inputFile: string;
  meta: VideoMeta;
  mediaRefs: MediaRef[];
  extraAssets: { name: string; type: string; rel: string; url: string }[];
  artifacts: Artifact[];
  instanceDirs: string[];
}

export interface Sample {
  id: string;
  file: string;
  voice: string;
  label: string;
  style: string;
  text: string;
  rate: string;
  pitch: string;
  duration_s: number;
  exists: boolean;
  url: string | null;
}

export interface WordBound {
  text: string;
  start: number;
  end: number;
}

export interface Segment {
  id: string;
  windowStart: number;
  windowEnd: number;
  text: string;
  audio: string;
  exists: boolean;
  url: string | null;
  bounds: WordBound[];
}

/** 作品发布配置（独立 publish.json，与渲染输入 user.json 解耦；结构对多平台通用） */
export interface PublishCoverSet {
  horizontal?: string;
  vertical?: string;
}

export interface PublishConfig {
  /** 发布标题 */
  title?: string;
  /** 正文文案 */
  body?: string;
  /** 话题标签（不含 # 前缀亦可，展示时补 #） */
  hashtags?: string[];
  /** 横屏 / 竖屏封面文件名或相对路径 */
  covers?: PublishCoverSet;
  /** 备注与发布注意事项 */
  notes?: string;
  /** 目标平台预留标识，默认按通用结构呈现 */
  platform?: string;
}
