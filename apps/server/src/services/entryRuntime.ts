import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../infra/paths.js';

export interface EntryRuntime {
  input: string;
  instance: string;
  previewOut: string;
  renderOut: string;
}

/** 解析命令兼容接口使用的旧视频条目目录结构。 */
export function resolveEntryRuntime(entryId: string, instanceName?: string): EntryRuntime | null {
  const videosRoot = path.join(ROOT, 'studio', 'videos');
  const candidates: Array<{ id: string; root: string; input: string }> = [];
  const legacyInput = path.join(videosRoot, 'input');
  if (fs.existsSync(legacyInput)) {
    for (const file of fs.readdirSync(legacyInput).filter((name) => name.endsWith('.json'))) {
      candidates.push({ id: file.replace(/\.json$/, ''), root: videosRoot, input: path.join(legacyInput, file) });
    }
  }
  if (fs.existsSync(videosRoot)) {
    for (const dir of fs.readdirSync(videosRoot, { withFileTypes: true }).filter((item) => item.isDirectory())) {
      const root = path.join(videosRoot, dir.name);
      const input = path.join(root, 'input', 'user.json');
      if (fs.existsSync(input)) candidates.push({ id: dir.name, root, input });
    }
  }
  const entry = candidates.find((item) => item.id === entryId);
  if (!entry) return null;
  const requested = (instanceName ?? '').trim();
  const instance = requested && /^[A-Za-z0-9._-]+$/.test(requested) ? requested : 'instance';
  const rel = (absolute: string) => path.relative(ROOT, absolute).split(path.sep).join('/');
  return {
    input: rel(entry.input),
    instance: rel(path.join(entry.root, instance)),
    previewOut: rel(path.join(entry.root, 'preview.jpg')),
    renderOut: rel(path.join(entry.root, 'output.mp4')),
  };
}
