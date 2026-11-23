import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, findBin } from '../infra/paths.js';

export interface EnvItem {
  key: string;
  label: string;
  desc: string | null;
  ok: boolean;
  version: string | null;
  path: string | null;
  hint: string | null;
}

export interface EnvReport {
  items: EnvItem[];
  summary: { ok: number; total: number };
}

interface CommandResult {
  ok: boolean;
  raw: string;
}

function run(cmd: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 8000 }, (err, stdout, stderr) => {
      const raw = (stdout || stderr || '').toString().trim();
      resolve({ ok: !err, raw });
    });
  });
}

function firstLine(raw: string): string | null {
  return raw.split(/\r?\n/)[0]?.trim() || null;
}

function versionOf(raw: string, regex: RegExp): string | null {
  const m = raw.match(regex);
  return m ? m[1] : firstLine(raw);
}

function executable(file: string): boolean {
  try {
    return fs.accessSync(file, fs.constants.X_OK), fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function browserCandidates(): string[] {
  if (process.platform === 'win32') {
    return [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
      .filter((d): d is string => Boolean(d))
      .flatMap((dir) => [
        path.join(dir, 'Google/Chrome/Application/chrome.exe'),
        path.join(dir, 'Microsoft/Edge/Application/msedge.exe'),
      ]);
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
}

// playwright 缓存目录里按文件名认 Chromium 内核可执行文件（与模板包 chrome.mjs 对齐）
const CACHE_BIN_NAMES = new Set([
  'Google Chrome for Testing',
  'Chromium',
  'chrome',
  'chrome.exe',
  'headless_shell',
  'chrome-headless-shell',
]);

function searchCache(dir: string, depth = 0): string[] {
  if (!fs.existsSync(dir) || depth > 7) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((item) => {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) return searchCache(file, depth + 1);
    return CACHE_BIN_NAMES.has(item.name) && executable(file) ? [file] : [];
  });
}

function cacheBrowserPaths(): string[] {
  const caches = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), 'Library/Caches/ms-playwright'),
    path.join(os.homedir(), '.cache/ms-playwright'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
  ].filter((p): p is string => Boolean(p) && p !== '0');
  return caches.flatMap((dir) => searchCache(dir));
}

async function checkNode(): Promise<EnvItem> {
  return {
    key: 'node', label: 'Node.js', desc: '运行后端服务与模板 Node 脚本',
    ok: true, version: process.version.slice(1), path: process.execPath, hint: null,
  };
}

async function checkPnpm(): Promise<EnvItem> {
  const bin = findBin('pnpm');
  const res = bin ? await run(bin, ['-v']) : { ok: false, raw: '' };
  return {
    key: 'pnpm', label: 'pnpm', desc: '安装、运行工程依赖与脚本命令', ok: res.ok,
    version: res.ok ? res.raw : null, path: bin,
    hint: res.ok ? null : '运行 corepack enable，或 corepack prepare pnpm@latest --activate',
  };
}

async function checkUv(): Promise<EnvItem> {
  const bin = findBin('uv');
  const res = bin ? await run(bin, ['--version']) : { ok: false, raw: '' };
  return {
    key: 'uv', label: 'uv（Python 包管理）', desc: '按脚本头声明创建并管理 TTS 的 Python 环境', ok: res.ok,
    version: res.ok ? versionOf(res.raw, /uv\s+([\d.]+)/) : null, path: bin,
    hint: res.ok ? null : '从 apps/server/vendor/ 或 PATH 提供 uv，版本见 DEPENDENCIES.md',
  };
}

async function checkFfmpeg(name: string, label: string, desc: string, regex: RegExp): Promise<EnvItem> {
  const bin = findBin(name);
  const res = bin ? await run(bin, ['-version']) : { ok: false, raw: '' };
  return {
    key: name, label, desc, ok: res.ok,
    version: res.ok ? versionOf(res.raw, regex) : null, path: bin,
    hint: res.ok ? null : '放到 apps/server/vendor/ 或加入 PATH（也可 brew / winget 装到系统）；版本要求见 DEPENDENCIES.md',
  };
}

async function checkChrome(): Promise<EnvItem> {
  // 1. 环境变量显式指定的可执行文件
  const explicit = process.env.CHROME;
  if (explicit) {
    const file = path.resolve(explicit);
    if (executable(file)) {
      return {
        key: 'chrome', label: 'Chromium 内核浏览器', desc: '模板无头预览与渲染截图，Chrome / Edge / Chromium / headless shell 均可',
        ok: true, version: null, path: file, hint: null,
      };
    }
  }
  // 2. 系统候选（Chrome / Edge / Chromium）；3. playwright 缓存里的 headless shell
  const found = [...browserCandidates(), ...cacheBrowserPaths()].find(executable);
  return {
    key: 'chrome', label: 'Chromium 内核浏览器', desc: '模板无头预览与渲染截图，Chrome / Edge / Chromium / headless shell 均可',
    ok: Boolean(found), version: null, path: found || null,
    hint: found ? null : '安装 Chrome / Edge / Chromium，或设置 CHROME 指向可执行文件；也可用 playwright 安装的 headless shell',
  };
}

async function checkDir(key: string, label: string, desc: string, rel: string, hint: string): Promise<EnvItem> {
  const abs = path.join(ROOT, rel);
  const exists = fs.existsSync(abs);
  return { key, label, desc, ok: exists, version: null, path: abs, hint: exists ? null : hint };
}

function firstAdapterTemplate(): string | null {
  const base = path.join(ROOT, 'studio', 'templates');
  if (!fs.existsSync(base)) return null;
  for (const name of fs.readdirSync(base)) {
    const dir = path.join(base, name);
    if (fs.existsSync(path.join(dir, 'adapter.py'))) return `studio/templates/${name}`;
  }
  return null;
}

async function checkNodeDeps(): Promise<EnvItem> {
  const tpl = firstAdapterTemplate();
  if (!tpl) {
    return { key: 'nodeDeps', label: 'Node 依赖目录', desc: '所选模板自身的 Node 依赖目录', ok: false, version: null, path: null, hint: '还没有可渲染模板，先从官网下载并导入 .motion 包' };
  }
  return checkDir('nodeDeps', 'Node 依赖目录', '所选模板自身的 Node 依赖目录', `${tpl}/node_modules`, `在 ${tpl}/ 下执行 npm ci 安装模板 Node 依赖`);
}

export async function collectEnvironment(): Promise<EnvReport> {
  const items = await Promise.all<EnvItem>([
    checkNode(),
    checkPnpm(),
    checkUv(),
    checkFfmpeg('ffmpeg', 'ffmpeg', '音视频合成、转码、抽帧与混音', /ffmpeg version ([\d.]+)/),
    checkFfmpeg('ffprobe', 'ffprobe', '读取音视频时长、编码与流信息', /ffprobe version ([\d.]+)/),
    checkChrome(),
    checkNodeDeps(),
    checkDir('pythonVenv', 'TTS Python 环境', 'TTS 脚本的 Python 虚拟环境（离线/预热用）', 'apps/server/python/.venv', '工程根执行 pnpm setup:python（即 uv sync）生成'),
    checkDir('binTools', '本地二进制 apps/server/vendor/', '稳定大二进制目录，ffmpeg / ffprobe / uv 等可放这里（不入库）', 'apps/server/vendor', '将 ffmpeg、ffprobe、uv 放入 apps/server/vendor/，或用 brew / winget 装到系统'),
  ]);
  const okCount = items.filter((i) => i.ok).length;
  return { items, summary: { ok: okCount, total: items.length } };
}
