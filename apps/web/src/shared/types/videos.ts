import type { ProbeResult } from '@ai-motion/shared/types';

export type { ProbeResult };

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
