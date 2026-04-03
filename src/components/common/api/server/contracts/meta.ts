import type { ApiErrorCategory } from "./errors";

export type BaseMetaSource =
  | "GEMINI"
  | "ECOUNT"
  | "KMA"
  | "ECO_PRICE"
  | "ECO_CERT"
  | "NAVER"
  | "GARAK"
  | "DB"
  | "SYSTEM";

export interface BaseMeta {
  source: BaseMetaSource;
  requestId: string;
  timestamp: string;
  durationMs: number;
  pagination?: {
    total: number;
    page: number;
    limit: number;
  };
  errorCategory?: ApiErrorCategory;
  extra?: Record<string, unknown>;
}
