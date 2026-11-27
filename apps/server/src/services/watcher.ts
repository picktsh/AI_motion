import path from 'node:path';
import fs from 'node:fs';
import chokidar, { type FSWatcher } from 'chokidar';
import { ROOT, WATCH_ROOTS, WATCH_IGNORE } from '../infra/paths.js';

// 目录监听：按白名单根扫描磁盘变动，200ms 去抖归并后按域推送变更事件。
// 事件域：project 项目台账/入参、artifact 成片产物、asset 可复用素材、template 模板包。
// SSE 只负责把事件推给前端，各域接口仍由前端按需重拉；本层不做缓存盘点。

export type ChangeDomain = 'project' | 'artifact' | 'asset' | 'template';
export type ChangeKind = 'add' | 'change' | 'unlink';

export interface ChangeEvent {
  domain: ChangeDomain;
  kind: ChangeKind;
  rel: string;
  at: number;
}

type Listener = (event: ChangeEvent) => void;

const listeners = new Set<Listener>();
let watcher: FSWatcher | null = null;
let ready = false;

const pending = new Map<string, { kind: ChangeKind; domain: ChangeDomain }>();
let flushTimer: NodeJS.Timeout | null = null;

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function normalize(abs: string): string {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function classify(rel: string): ChangeDomain | null {
  if (rel.startsWith('studio/templates/')) return 'template';
  if (/^studio\/projects\/[^/]+\/output\//.test(rel)) return 'artifact';
  if (rel.startsWith('studio/projects/')) return 'project';
  if (rel.startsWith('studio/tts/') || rel.startsWith('studio/public/') || rel.startsWith('studio/assets/')) {
    return 'asset';
  }
  return null;
}

function isIgnored(rel: string): boolean {
  return WATCH_IGNORE.some((re) => re.test(rel));
}

function enqueue(abs: string, kind: ChangeKind): void {
  const rel = normalize(abs);
  if (!rel || isIgnored(rel)) return;
  const domain = classify(rel);
  if (!domain) return;
  pending.set(rel, { kind, domain });

  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const at = Date.now();
    for (const [rel, entry] of pending) {
      const event: ChangeEvent = { domain: entry.domain, kind: entry.kind, rel, at };
      for (const listener of listeners) listener(event);
    }
    pending.clear();
  }, 200);
}

/** 启动监听；重复调用不重复挂载。根目录不存在时跳过，等后续创建后由重启补扫。 */
export function startWatcher(): void {
  if (watcher) return;
  const roots = WATCH_ROOTS.map((r) => path.join(ROOT, r)).filter((dir) => fs.existsSync(dir));
  if (roots.length === 0) return;

  watcher = chokidar.watch(roots, {
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false,
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
    ignored: (p: string) => isIgnored(normalize(p)),
  });

  watcher.on('ready', () => {
    ready = true;
  });
  watcher.on('add', (p) => ready && enqueue(p, 'add'));
  watcher.on('change', (p) => ready && enqueue(p, 'change'));
  watcher.on('unlink', (p) => ready && enqueue(p, 'unlink'));
  watcher.on('addDir', (p) => ready && enqueue(p, 'add'));
  watcher.on('unlinkDir', (p) => ready && enqueue(p, 'unlink'));
  watcher.on('error', () => {
    /* 监听错误不打断服务；下一轮事件自然恢复 */
  });
}

export async function stopWatcher(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer);
  pending.clear();
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  ready = false;
}
