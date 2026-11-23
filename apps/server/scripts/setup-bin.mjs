#!/usr/bin/env node
// 安装期尽力而为地把 server 运行所需的第三方二进制准备到 apps/server/vendor/：
//   - ffmpeg / ffprobe：取自依赖 ffmpeg-static / ffprobe-static（二者 postinstall 已按平台下载），
//     硬链/拷贝进 vendor，使 findBin / PATH 注入 / Python 回退沿用既有的 vendor 单一出口；
//   - uv / uvx：astral 无官方 npm 包，按平台从其 GitHub release 下载解压进 vendor。
// 原则：幂等（已存在即跳过）、离线/失败仅告警不阻断 pnpm install。
// 开关：SKIP_BIN_DOWNLOAD=1 关闭全部；UV_VERSION 锁 uv 版本；UV_MIRROR/FFMPEG_BINARIES_URL 配镜像。
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const VENDOR = path.resolve(HERE, '..', 'vendor');
const IS_WIN = process.platform === 'win32';
const EXE = IS_WIN ? '.exe' : '';
const SKIP = process.env.SKIP_BIN_DOWNLOAD === '1';
const UV_VERSION = process.env.UV_VERSION || '0.13.9';

const log = (m) => console.log(`[setup-bin] ${m}`);
const warn = (m) => console.warn(`[setup-bin][warn] ${m}`);

// 落位：同卷硬链优先（零额外空间），跨卷回退拷贝；Windows 文件名补 .exe。
function place(name, src) {
  const dest = path.join(VENDOR, name);
  if (fs.existsSync(dest)) { log(`${name} 已存在，跳过`); return; }
  fs.mkdirSync(VENDOR, { recursive: true });
  try { fs.linkSync(src, dest); }
  catch { fs.copyFileSync(src, dest); }
  try { fs.chmodSync(dest, 0o755); } catch { /* win 无 chmod 语义 */ }
  log(`${name} 就位 ← ${src}`);
}

// 从 npm 包取二进制绝对路径（ffmpeg-static/ffprobe-static 默认导出路径字符串，兼容 {path}）。
function fromNpm(mod, name) {
  try {
    const v = require(mod);
    const p = typeof v === 'string' ? v : v && v.path;
    if (p && fs.existsSync(p)) place(name + EXE, p);
    else warn(`${mod} 未给出有效二进制路径（其 postinstall 可能被 pnpm 拦下？请确认 pnpm-workspace.yaml 已把该包列入 allowBuilds）`);
  } catch (e) { warn(`解析 ${mod} 失败：${e.message}`); }
}

// 平台 → uv release 归档名 + 解包方式。
function uvAsset() {
  const { platform: p, arch: a } = process;
  if (p === 'darwin' && a === 'arm64') return ['uv-aarch64-apple-darwin.tar.gz', 'tar'];
  if (p === 'darwin' && a === 'x64') return ['uv-x86_64-apple-darwin.tar.gz', 'tar'];
  if (p === 'linux' && a === 'x64') return ['uv-x86_64-unknown-linux-gnu.tar.gz', 'tar'];
  if (p === 'win32' && a === 'x64') return ['uv-x86_64-pc-windows-msvc.zip', 'zip'];
  return null;
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function extract(archive, dir, kind) {
  if (kind === 'tar') execFileSync('tar', ['-xzf', archive, '-C', dir]);
  else execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${dir}'`]);
}

async function setupUv() {
  if (fs.existsSync(path.join(VENDOR, `uv${EXE}`))) { log('uv 已存在，跳过'); return; }
  const spec = uvAsset();
  if (!spec) { warn(`未支持的平台 ${process.platform}/${process.arch}，请手动放置 uv 到 apps/server/vendor/`); return; }
  const [file, kind] = spec;
  const base = process.env.UV_MIRROR || 'https://github.com/astral-sh/uv/releases/download';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uv-'));
  try {
    log(`下载 uv ${UV_VERSION}（${file}）`);
    const archive = path.join(tmp, file);
    await download(`${base}/${UV_VERSION}/${file}`, archive);
    extract(archive, tmp, kind);
    const found = fs.readdirSync(tmp, { recursive: true, encoding: 'utf8' }).filter((f) => /^(uv|uvx)(\.exe)?$/.test(path.basename(f)));
    for (const f of found) {
      const name = path.basename(f);
      place(name, path.join(tmp, f));
    }
    if (!found.some((f) => path.basename(f).startsWith('uv'))) warn('归档内未找到 uv 可执行文件');
  } catch (e) {
    warn(`uv 下载/解包失败（可稍后手动放 apps/server/vendor/）：${e.message}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  if (SKIP) { log('SKIP_BIN_DOWNLOAD=1，跳过全部准备'); return; }
  try {
    await fromNpm('ffmpeg-static', 'ffmpeg');
    await fromNpm('ffprobe-static', 'ffprobe');
    await setupUv();
    log('完成');
  } catch (e) {
    // 顶层兜底：任何异常都不让 pnpm install 失败，改由环境页暴露缺失。
    warn(`准备过程异常（不阻断安装）：${e.message}`);
  }
}

await main();
