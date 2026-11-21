import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';

function readJson(abs) {
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { return null; }
}

function assetUrl(rel) {
  return `/api/assets?path=${encodeURIComponent(rel)}`;
}

export function listSamples() {
  const dir = path.join(ROOT, 'studio', 'tts', 'samples');
  const samples = readJson(path.join(dir, 'samples.json')) || [];
  return samples.map((s) => {
    const rel = `studio/tts/samples/${s.file}`;
    const abs = path.join(ROOT, rel);
    return { ...s, exists: fs.existsSync(abs), url: fs.existsSync(abs) ? assetUrl(rel) : null };
  });
}

export function listSegments() {
  const dir = path.join(ROOT, 'studio', 'tts', 'segments');
  const segments = readJson(path.join(dir, 'segments.json')) || [];
  return segments.map((seg) => {
    const rel = seg.audio;
    const abs = rel ? path.join(ROOT, rel) : null;
    return {
      ...seg,
      exists: abs ? fs.existsSync(abs) : false,
      url: abs && fs.existsSync(abs) ? assetUrl(rel) : null,
    };
  });
}
