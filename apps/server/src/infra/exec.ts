import { spawn, type ChildProcess } from 'node:child_process';
import { platform } from 'node:os';

// 子进程执行器：参数数组拉起、不走 shell；按行回流 stdout/stderr；
// 支持超时与取消，posix 下以独立进程组拉起，便于一次性终止整棵子进程树。

export interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
}

export interface ExecHandle {
  pid: number;
  kill: () => void;
}

export interface RunProcessOptions {
  cmd: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  onLine?: (stream: 'stdout' | 'stderr', text: string) => void;
}

export interface ProcessRun {
  promise: Promise<ExecResult>;
  handle: ExecHandle;
}

const isPosix = platform() !== 'win32';

function killTree(proc: ChildProcess): void {
  if (proc.pid == null) return;
  try {
    if (isPosix) {
      // 独立进程组：负 pid 向整组发信号；失败再降级到单进程。
      process.kill(-proc.pid, 'SIGTERM');
    } else {
      proc.kill('SIGTERM');
    }
  } catch {
    try {
      proc.kill('SIGTERM');
    } catch {
      /* 进程已退出 */
    }
  }
}

export function runProcess(opts: RunProcessOptions): ProcessRun {
  const { cmd, args, cwd, env, timeoutMs, onLine } = opts;

  const proc = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    shell: false,
    detached: isPosix,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdoutBuf = '';
  let stderrBuf = '';
  let stdoutFull = '';
  let stderrFull = '';
  let timedOut = false;
  let cancelled = false;
  let settled = false;
  let timer: NodeJS.Timeout | null = null;

  const pushLine = (stream: 'stdout' | 'stderr', line: string) => {
    if (line) onLine?.(stream, line);
  };

  const sink = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    if (stream === 'stdout') stdoutFull += text;
    else stderrFull += text;
    let buf = stream === 'stdout' ? stdoutBuf : stderrBuf;
    buf += text;
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      pushLine(stream, buf.slice(0, idx).replace(/\r$/, ''));
      buf = buf.slice(idx + 1);
    }
    if (stream === 'stdout') stdoutBuf = buf;
    else stderrBuf = buf;
  };

  proc.stdout?.on('data', sink('stdout'));
  proc.stderr?.on('data', sink('stderr'));

  const promise = new Promise<ExecResult>((resolve) => {
    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        killTree(proc);
      }, timeoutMs);
    }

    const finish = (code: number | null, errMessage?: string) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (errMessage) stderrFull += (stderrFull ? '\n' : '') + errMessage;
      pushLine('stdout', stdoutBuf.replace(/\r$/, ''));
      pushLine('stderr', stderrBuf.replace(/\r$/, ''));
      resolve({ code, stdout: stdoutFull, stderr: stderrFull, timedOut, cancelled });
    };

    proc.once('error', (err) => finish(null, err.message));
    proc.once('exit', (code) => finish(code));
  });

  const handle: ExecHandle = {
    pid: proc.pid ?? -1,
    kill: () => {
      cancelled = true;
      killTree(proc);
    },
  };

  return { promise, handle };
}
