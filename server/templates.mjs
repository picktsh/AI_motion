import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';

function readJson(abs) {
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { return null; }
}

function listDirs(base) {
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function discover() {
  const found = [];
  // 旧路径 studio/template/ 本身就是一个模板目录，不再向下扫子目录
  const legacy = path.join(ROOT, 'studio', 'template');
  const legacyMotion = readJson(path.join(legacy, 'motion.json'));
  if (legacyMotion) {
    found.push({ dir: 'studio/template', origin: 'local', slug: legacyMotion.template?.id || 'template', tplDir: legacy, motion: legacyMotion });
  }
  // 二期结构：studio/templates/ 与 studio/templates-cache/ 下每个子目录是一个模板
  for (const dir of ['studio/templates', 'studio/templates-cache']) {
    const base = path.join(ROOT, dir);
    for (const name of listDirs(base)) {
      const tplDir = path.join(base, name);
      const motion = readJson(path.join(tplDir, 'motion.json'));
      if (motion) found.push({ dir, origin: dir.includes('templates-cache') ? 'cache' : 'local', slug: name, tplDir, motion });
    }
  }
  return found;
}

export function listTemplates() {
  return discover().map(({ origin, slug, tplDir, motion }) => {
    const t = motion?.template || {};
    const runtime = motion?.runtime || {};
    const license = motion?.license?.file || null;
    return {
      id: t.id || slug,
      slug,
      name: t.name || slug,
      version: t.version || null,
      origin,
      localPath: path.relative(ROOT, tplDir),
      runtime: { profile: runtime.profile || null, entry: runtime.entry || null },
      license,
      network: motion?.permissions?.network ?? null,
      inPlace: fs.existsSync(tplDir),
    };
  });
}

function fileTree(dir, depth = 0, maxDepth = 3) {
  if (depth > maxDepth || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => !['node_modules', '.git', '__pycache__'].includes(d.name))
    .map((d) => {
      const abs = path.join(dir, d.name);
      return {
        name: d.name,
        type: d.isDirectory() ? 'dir' : 'file',
        size: d.isFile() ? fs.statSync(abs).size : null,
        children: d.isDirectory() ? fileTree(abs, depth + 1, maxDepth) : [],
      };
    });
}

export function getTemplate(id) {
  const hit = discover().find(({ motion, slug }) => (motion?.template?.id || slug) === id);
  if (!hit) return null;
  const { tplDir, motion, origin } = hit;
  const lock = readJson(path.join(tplDir, 'motion.lock.json'));
  const t = motion?.template || {};
  const runtime = motion?.runtime || {};
  const licenseFile = motion?.license?.file || null;
  const licenseAbs = licenseFile ? path.join(tplDir, licenseFile) : null;
  return {
    id: t.id || hit.slug,
    slug: hit.slug,
    name: t.name || hit.slug,
    version: t.version || null,
    origin,
    localPath: path.relative(ROOT, tplDir),
    runtime,
    lock,
    license: { file: licenseFile, present: licenseAbs ? fs.existsSync(licenseAbs) : false },
    output: motion?.output || null,
    permissions: motion?.permissions || null,
    extensions: motion?.extensions || null,
    fileTree: fileTree(tplDir),
  };
}
