import type { BaseMeta } from "./meta";

export type ApiResponse<T> =
  | { ok: true; data: T; message?: string; meta: BaseMeta }
  | { ok: false; data: null; message: string; meta: BaseMeta };
