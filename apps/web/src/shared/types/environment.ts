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
