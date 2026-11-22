import path from 'node:path';
import { ROOT, resolveSafe, findBin } from '../infra/paths.js';
import { config } from '../config.js';
import type { CommandName, JobArtifact } from '@ai-motion/shared/types';

// 命令注册表：白名单命令、参数解析与路径安全校验、依赖可执行、产物引用。
// 后端只按命令模板拼参数数组，不接受任意命令串；路径一律经白名单解析。

export interface CommandParams {
  input?: string;
  instance?: string;
  out?: string;
  time?: number;
  [key: string]: unknown;
}

type ScriptKind = 'adapter' | 'voice' | 'samples';

interface ResolvedPath {
  abs: string;
  rel: string;
}

export interface ResolvedCommand {
  name: CommandName;
  group: 'render' | 'default';
  timeoutKind: 'default' | 'render';
  script: ScriptKind;
  scriptArgs: string[];
  artifact: JobArtifact | null;
  missingBins: string[];
}

interface CommandDef {
  name: CommandName;
  group: 'render' | 'default';
  timeoutKind: 'default' | 'render';
  script: ScriptKind;
  bins: string[];
  resolve: (params: CommandParams) => { scriptArgs: string[]; artifact: JobArtifact | null } | string;
}

const SCRIPT_ABS: Record<ScriptKind, string> = {
  adapter: path.join(ROOT, 'studio', 'template', 'adapter.py'),
  voice: path.join(ROOT, 'studio', 'tts', 'make_voice.py'),
  samples: path.join(ROOT, 'studio', 'tts', 'gen_samples.py'),
};

function assetUrl(rel: string): string {
  return `${config.apiPrefix}/assets?path=${encodeURIComponent(rel)}`;
}

function safeRel(rel: unknown, field: string): ResolvedPath | string {
  if (typeof rel !== 'string' || !rel.trim()) return `缺少参数 ${field}`;
  const abs = resolveSafe(rel);
  if (!abs) return `${field} 路径越出 studio 白名单目录`;
  return { abs, rel: rel.split(path.sep).join('/') };
}

function asArtifact(rel: ResolvedPath): JobArtifact {
  return { rel: rel.rel, url: assetUrl(rel.rel) };
}

function parseTime(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const COMMANDS: Record<CommandName, CommandDef> = {
  plan: {
    name: 'plan',
    group: 'default',
    timeoutKind: 'default',
    script: 'adapter',
    bins: ['uv'],
    resolve: (p) => {
      const input = safeRel(p.input, 'input');
      if (typeof input === 'string') return input;
      return { scriptArgs: ['plan', '--input', input.abs], artifact: null };
    },
  },
  prepare: {
    name: 'prepare',
    group: 'default',
    timeoutKind: 'default',
    script: 'adapter',
    bins: ['uv', 'ffmpeg'],
    resolve: (p) => {
      const input = safeRel(p.input, 'input');
      if (typeof input === 'string') return input;
      const instance = safeRel(p.instance, 'instance');
      if (typeof instance === 'string') return instance;
      return {
        scriptArgs: ['prepare', '--input', input.abs, '--out', instance.abs],
        artifact: null,
      };
    },
  },
  preview: {
    name: 'preview',
    group: 'default',
    timeoutKind: 'default',
    script: 'adapter',
    bins: ['uv', 'node'],
    resolve: (p) => {
      const instance = safeRel(p.instance, 'instance');
      if (typeof instance === 'string') return instance;
      const out = safeRel(p.out, 'out');
      if (typeof out === 'string') return out;
      const time = parseTime(p.time);
      const scriptArgs = ['preview', '--instance', instance.abs, '--out', out.abs];
      if (time != null) scriptArgs.push('--time', String(time));
      return { scriptArgs, artifact: asArtifact(out) };
    },
  },
  render: {
    name: 'render',
    group: 'render',
    timeoutKind: 'render',
    script: 'adapter',
    bins: ['uv', 'node', 'ffmpeg'],
    resolve: (p) => {
      const instance = safeRel(p.instance, 'instance');
      if (typeof instance === 'string') return instance;
      const out = safeRel(p.out, 'out');
      if (typeof out === 'string') return out;
      return {
        scriptArgs: ['render', '--instance', instance.abs, '--out', out.abs],
        artifact: asArtifact(out),
      };
    },
  },
  'tts:voice': {
    name: 'tts:voice',
    group: 'default',
    timeoutKind: 'default',
    script: 'voice',
    bins: ['uv'],
    resolve: () => ({ scriptArgs: [], artifact: null }),
  },
  'tts:samples': {
    name: 'tts:samples',
    group: 'default',
    timeoutKind: 'default',
    script: 'samples',
    bins: ['uv', 'ffprobe'],
    resolve: () => ({ scriptArgs: [], artifact: null }),
  },
};

export function commandNames(): CommandName[] {
  return Object.keys(COMMANDS) as CommandName[];
}

export function resolveCommand(
  name: CommandName,
  params: CommandParams,
): ResolvedCommand | string {
  const def = COMMANDS[name];
  if (!def) return `未知命令 ${name}`;
  const resolved = def.resolve(params);
  if (typeof resolved === 'string') return resolved;

  const missingBins = def.bins.filter((bin) => !findBin(bin));
  return {
    name: def.name,
    group: def.group,
    timeoutKind: def.timeoutKind,
    script: def.script,
    scriptArgs: resolved.scriptArgs,
    artifact: resolved.artifact,
    missingBins,
  };
}

export function scriptAbs(kind: ScriptKind): string {
  return SCRIPT_ABS[kind];
}
