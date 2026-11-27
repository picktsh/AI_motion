export interface RuntimeItem {
  key: string;
  label: string;
  value: string;
  /** 当前值来源：环境变量显式提供 / 内置缺省。 */
  source: 'env' | 'default';
  env: string | null;
  fallback: string | null;
  note: string | null;
}

export interface RuntimeAuth {
  enabled: boolean;
  keyLength: number | null;
  header: string;
  note: string;
}

export interface RuntimePaths {
  root: string;
  read: string[];
  write: string[];
  watch: string[];
}

export interface RuntimeReport {
  service: string;
  version: string;
  origin: string;
  loopbackOnly: boolean;
  auth: RuntimeAuth;
  items: RuntimeItem[];
  paths: RuntimePaths;
  textLimits: { readBytes: number; writeBytes: number; extensions: string[] };
  jobs: {
    renderConcurrency: number;
    defaultConcurrency: number;
    renderTimeoutMs: number;
    defaultTimeoutMs: number;
    logCapacity: number;
    maxRetained: number;
  };
}
