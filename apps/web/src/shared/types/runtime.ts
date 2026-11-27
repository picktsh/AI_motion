export interface RuntimeItem {
  key: string;
  label: string;
  value: string;
  /** 当前值来源：环境变量 / 本地配置文件 / 内置缺省。 */
  source: 'env' | 'file' | 'default';
  /** 对应环境变量名或配置字段，缺省来源时为 null。 */
  origin: string | null;
  fallback: string | null;
  note: string | null;
}

export interface RuntimeAuth {
  enabled: boolean;
  keyCount: number;
  /** 仅单把密钥时给长度，多把时为 null。 */
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
  protocol: string;
  origin: string;
  loopbackOnly: boolean;
  configFile: string | null;
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
