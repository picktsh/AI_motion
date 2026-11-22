import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../infra/paths.js';
import { config } from '../config.js';

export interface WordBound {
  text?: string;
  start?: number;
  end?: number;
}

interface SampleRaw {
  id?: string;
  file?: string;
  voice?: string;
  label?: string;
  style?: string;
  text?: string;
  rate?: number;
  pitch?: number;
  duration_s?: number;
  [key: string]: unknown;
}

export interface Sample extends SampleRaw {
  exists: boolean;
  url: string | null;
}

interface SegmentRaw {
  id?: string;
  windowStart?: number;
  windowEnd?: number;
  text?: string;
  audio?: string;
  bounds?: WordBound[];
  [key: string]: unknown;
}

export interface Segment extends SegmentRaw {
  exists: boolean;
  url: string | null;
}

function readJsonArray(abs: string): unknown[] {
  try {
    const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function assetUrl(rel: string): string {
  return `${config.apiPrefix}/assets?path=${encodeURIComponent(rel)}`;
}

export function listSamples(): Sample[] {
  const dir = path.join(ROOT, 'studio', 'tts', 'samples');
  const samples = readJsonArray(path.join(dir, 'samples.json')) as SampleRaw[];
  return samples.map((s) => {
    const rel = `studio/tts/samples/${s.file}`;
    const abs = path.join(ROOT, rel);
    const exists = fs.existsSync(abs);
    return { ...s, exists, url: exists ? assetUrl(rel) : null };
  });
}

export function listSegments(): Segment[] {
  const dir = path.join(ROOT, 'studio', 'tts', 'segments');
  const segments = readJsonArray(path.join(dir, 'segments.json')) as SegmentRaw[];
  return segments.map((seg) => {
    const rel = seg.audio;
    const abs = rel ? path.join(ROOT, rel) : null;
    const exists = abs ? fs.existsSync(abs) : false;
    return {
      ...seg,
      exists,
      url: abs && exists && rel ? assetUrl(rel) : null,
    };
  });
}
