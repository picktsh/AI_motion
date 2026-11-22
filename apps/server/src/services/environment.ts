import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, findBin } from '../infra/paths.js';

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

function chromeCandidates(): string[] {
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
      '/Applications/Microsoft Edge.app/Contents/Microsoft Edge',
    ];
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'];
}

async function checkNode(): Promise<EnvItem> {
  return { key: 'node', label: 'Node.js', ok: true, version: process.version.slice(1), path: process.execPath, hint: null };
}

async function checkPnpm(): Promise<EnvItem> {
  const bin = findBin('pnpm');
  const res = bin ? await run(bin, ['-v']) : { ok: false, raw: '' };
  return {
    key: 'pnpm', label: 'pnpm', ok: res.ok,
    version: res.ok ? res.raw : null, path: bin,
    hint: res.ok ? null : '运行 corepack enable，或 corepack prepare pnpm@latest --activate',
  };
}

async function checkUv(): Promise<EnvItem> {
  const bin = findBin('uv');
  const res = bin ? await run(bin, ['--version']) : { ok: false, raw: '' };
  return {
    key: 'uv', label: 'uv（Python 包管理）', ok: res.ok,
    version: res.ok ? versionOf(res.raw, /uv\s+([\d.]+)/) : null, path: bin,
    hint: res.ok ? null : '从 bin/ 或 PATH 提供 uv，版本见 DEPENDENCIES.md',
  };
}

async function checkFfmpeg(name: string, label: string, regex: RegExp): Promise<EnvItem> {
  const bin = findBin(name);
  const res = bin ? await run(bin, ['-version']) : { ok: false, raw: '' };
  return {
    key: name, label, ok: res.ok,
    version: res.ok ? versionOf(res.raw, regex) : null, path: bin,
    hint: res.ok ? null : '放到 bin/ 或加入 PATH；版本要求见 DEPENDENCIES.md',
  };
}

async function checkChrome(): Promise<EnvItem> {
  const found = chromeCandidates().find((p) => {
    try { return fs.accessSync(p, fs.constants.X_OK), fs.statSync(p).isFile(); } catch { return false; }
  });
  return {
    key: 'chrome', label: 'Chrome / Chromium', ok: Boolean(found),
    version: null, path: found || null,
    hint: found ? null : '安装 Chrome，或设置 CHROME 指向可执行文件',
  };
}

async function checkDir(key: string, label: string, rel: string, hint: string): Promise<EnvItem> {
  const abs = path.join(ROOT, rel);
  const exists = fs.existsSync(abs);
  return { key, label, ok: exists, version: null, path: abs, hint: exists ? null : hint };
}

export async function collectEnvironment(): Promise<EnvReport> {
  const items = await Promise.all<EnvItem>([
    checkNode(),
    checkPnpm(),
    checkUv(),
    checkFfmpeg('ffmpeg', 'ffmpeg', /ffmpeg version ([\d.]+)/),
    checkFfmpeg('ffprobe', 'ffprobe', /ffprobe version ([\d.]+)/),
    checkChrome(),
    checkDir('nodeDeps', 'Node 依赖目录', 'studio/template/node_modules', '在 studio/template/ 下执行 pnpm install 安装模板 Node 依赖'),
    checkDir('pythonVenv', 'TTS Python 环境', 'studio/tts/.venv', '由 uv 根据脚本头 PEP723 自动创建'),
    checkDir('binTools', '本地二进制 studio/bin/', 'studio/bin', 'ffmpeg、ffprobe、uv 等外部二进制放在 studio/bin/'),
  ]);
  const okCount = items.filter((i) => i.ok).length;
  return { items, summary: { ok: okCount, total: items.length } };
}
