import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { runProcess, type ExecHandle, type ExecResult } from '../infra/exec.js';
import { resolveCommand, type CommandParams, type ResolvedCommand } from './commands.js';
import { resolveEntryRuntime } from './entryRuntime.js';
import { findBin, ROOT, BIN_DIR } from '../infra/paths.js';
import { config } from '../config.js';
import { badRequest, forbidden, notFound } from '../core/errors.js';
import type {
  CommandName,
  JobArtifact,
  JobLogLine,
  JobSnapshot,
  JobStatus,
} from '@ai-motion/shared/types';

// 命令台任务服务：内存任务表、按组并发的队列、状态机、增量日志与取消。
// 任务记录与日志缓冲只存内存，重启后清空；产物文件仍落盘保留。

type Group = 'render' | 'default';

interface JobRecord {
  id: string;
  command: CommandName;
  params: CommandParams;
  status: JobStatus;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  exitCode: number | null;
  error: { code: string; message: string; details?: unknown } | null;
  result: unknown;
  artifact: JobArtifact | null;
  log: JobLogLine[];
  nextLogSeq: number;
  handle: ExecHandle | null;
  cancelRequested: boolean;
  resolved: ResolvedCommand | null;
}

const jobs = new Map<string, JobRecord>();
const queue: string[] = [];
const runningByGroup: Record<Group, number> = { render: 0, default: 0 };

const GROUP_LIMIT: Record<Group, number> = {
  render: config.job.renderConcurrency,
  default: config.job.defaultConcurrency,
};

function pushLog(record: JobRecord, stream: 'stdout' | 'stderr', text: string): void {
  record.log.push({ seq: record.nextLogSeq++, stream, time: Date.now(), text });
  if (record.log.length > config.job.logCapacity) {
    record.log.splice(0, record.log.length - config.job.logCapacity);
  }
}

function parseResult(command: CommandName, stdout: string): unknown {
  const text = stdout.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.length > 2000 ? text.slice(-2000) : text;
  }
}

function snapshot(record: JobRecord): JobSnapshot {
  return {
    id: record.id,
    command: record.command,
    params: record.params,
    status: record.status,
    createdAt: record.createdAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    exitCode: record.exitCode,
    error: record.error,
    result: record.result,
    artifact: record.artifact,
    logLineCount: record.nextLogSeq - 1,
  };
}

export function submitJob(command: string, params: CommandParams): JobSnapshot {
  if (!command || typeof command !== 'string') throw badRequest('缺少命令名');
  const name = command as CommandName;

  let merged: CommandParams = { ...(params ?? {}) };
  const entryId = typeof merged.entryId === 'string' ? merged.entryId : null;
  if (entryId) {
    const instanceName = typeof merged.instanceName === 'string' ? merged.instanceName : undefined;
    const rt = resolveEntryRuntime(entryId, instanceName);
    if (!rt) throw badRequest('视频条目不存在');
    if (name === 'plan') merged.input = rt.input;
    if (name === 'prepare') {
      merged.input = rt.input;
      merged.instance = rt.instance;
    }
    if (name === 'preview') {
      merged.instance = rt.instance;
      merged.out = rt.previewOut;
    }
    if (name === 'render') {
      merged.instance = rt.instance;
      merged.out = rt.renderOut;
    }
    delete merged.entryId;
    delete merged.instanceName;
  }

  const resolved = resolveCommand(name, merged);
  if (typeof resolved === 'string') {
    if (resolved.includes('白名单')) throw forbidden(resolved);
    throw badRequest(resolved);
  }
  if (resolved.missingBins.length > 0) {
    throw badRequest('缺少执行依赖', { missingBins: resolved.missingBins });
  }

  const record: JobRecord = {
    id: `job_${randomUUID().replace(/-/g, '').slice(0, 10)}`,
    command: name,
    params: merged,
    status: 'queued',
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    error: null,
    result: null,
    artifact: resolved.artifact,
    log: [],
    nextLogSeq: 1,
    handle: null,
    cancelRequested: false,
    resolved,
  };

  jobs.set(record.id, record);
  queue.push(record.id);
  dispatch();
  return snapshot(record);
}

function dispatch(): void {
  for (const id of [...queue]) {
    const record = jobs.get(id);
    if (!record || record.status !== 'queued') continue;
    const group = record.resolved?.group ?? 'default';
    if (runningByGroup[group] >= GROUP_LIMIT[group]) continue;
    queue.splice(queue.indexOf(id), 1);
    void start(record);
  }
}

async function start(record: JobRecord): Promise<void> {
  const resolved = record.resolved;
  if (!resolved) return;
  const uv = findBin('uv');
  if (!uv) {
    finishWithError(record, 'uv 不可用', ['uv']);
    return;
  }

  record.status = 'running';
  record.startedAt = Date.now();
  runningByGroup[resolved.group] += 1;

  const script = resolved.scriptPath;
  const args = ['run', script, ...resolved.scriptArgs];
  const timeoutMs =
    resolved.timeoutKind === 'render' ? config.job.renderTimeoutMs : config.job.defaultTimeoutMs;
  // 前置本地 bin 目录：子进程内 Python/渲染脚本按名字调用 ffmpeg/ffprobe 时可解析。
  // PROJECT_ROOT 注入仓库根：Python 脚本据此定位 studio/ 素材与 apps/server/vendor，不再用 __file__ 深度反推。
  const env = {
    PATH: `${BIN_DIR}${path.delimiter}${process.env.PATH ?? ''}`,
    PROJECT_ROOT: ROOT,
  };

  const run = runProcess({
    cmd: uv,
    args,
    cwd: ROOT,
    env,
    timeoutMs,
    onLine: (stream, text) => pushLog(record, stream, text),
  });
  record.handle = run.handle;

  let outcome: ExecResult;
  try {
    outcome = await run.promise;
  } catch (e) {
    finishWithError(record, e instanceof Error ? e.message : String(e), []);
    return;
  }

  runningByGroup[resolved.group] -= 1;
  finish(record, outcome);
  dispatch();
}

function finish(record: JobRecord, outcome: ExecResult): void {
  record.finishedAt = Date.now();
  record.exitCode = outcome.code;
  record.handle = null;

  if (record.cancelRequested) {
    record.status = 'cancelled';
    return;
  }
  if (outcome.timedOut) {
    finishWithError(record, '任务超时已终止', []);
    return;
  }
  if (outcome.code === 0) {
    record.status = 'succeeded';
    record.result = parseResult(record.command, outcome.stdout);
    return;
  }
  const detail = outcome.stderr.trim() || outcome.stdout.trim() || `退出码 ${outcome.code}`;
  finishWithError(record, detail.slice(-500), []);
}

function finishWithError(record: JobRecord, message: string, missing: string[]): void {
  record.finishedAt = Date.now();
  record.handle = null;
  record.status = 'failed';
  record.error = {
    code: 'INTERNAL',
    message,
    ...(missing.length ? { details: { missingBins: missing } } : {}),
  };
}

export function getJob(id: string): JobSnapshot | null {
  const record = jobs.get(id);
  return record ? snapshot(record) : null;
}

export function listJobs(): JobSnapshot[] {
  return [...jobs.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, config.job.maxRetained)
    .map(snapshot);
}

export function getJobLogs(id: string, offset: number): { lines: JobLogLine[]; nextOffset: number; total: number } {
  const record = jobs.get(id);
  if (!record) throw notFound('任务不存在');
  const from = Number.isInteger(offset) && offset >= 0 ? offset : 0;
  const lines = record.log.filter((l) => l.seq > from);
  return { lines, nextOffset: lines.length ? lines[lines.length - 1].seq : Math.max(from, record.nextLogSeq - 1), total: record.nextLogSeq - 1 };
}

export function cancelJob(id: string): JobSnapshot {
  const record = jobs.get(id);
  if (!record) throw notFound('任务不存在');
  if (record.status === 'queued') {
    record.cancelRequested = true;
    record.status = 'cancelled';
    record.finishedAt = Date.now();
    const idx = queue.indexOf(id);
    if (idx >= 0) queue.splice(idx, 1);
  } else if (record.status === 'running') {
    record.cancelRequested = true;
    record.handle?.kill();
  }
  return snapshot(record);
}

// 服务关闭：终止在跑任务，队列内任务标记取消。
export function shutdownJobs(): void {
  for (const record of jobs.values()) {
    if (record.status === 'running') {
      record.cancelRequested = true;
      record.handle?.kill();
    } else if (record.status === 'queued') {
      record.cancelRequested = true;
      record.status = 'cancelled';
      record.finishedAt = Date.now();
    }
  }
  queue.length = 0;
}
