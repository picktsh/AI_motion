import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundledUv = path.join(root, 'apps', 'server', 'vendor', process.platform === 'win32' ? 'uv.exe' : 'uv');
const uv = fs.existsSync(bundledUv) ? bundledUv : 'uv';

// 优先使用项目自带的 uv；没有时再从系统 PATH 查找。
const result = spawnSync(uv, ['sync', '--project', 'apps/server/python'], {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) {
  process.stderr.write(`无法启动 uv：${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
