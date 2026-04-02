import type { ApiResponse } from "../contracts/response";
import type { BaseMeta, BaseMetaSource } from "../contracts/meta";
import type { ApiErrorCategory } from "../contracts/errors";
import { classifyHttpStatus } from "../contracts/errors";

type BuildSuccessParams<T> = {
  data: T;
  source: BaseMetaSource;
  requestId: string;
  startedAt: number;
  message?: string;
  pagination?: BaseMeta["pagination"];
  extra?: Record<string, unknown>;
};

type BuildErrorParams = {
  message: string;
  source: BaseMetaSource;
  requestId: string;
  startedAt: number;
  httpStatus?: number;
  errorCategory?: ApiErrorCategory;
  extra?: Record<string, unknown>;
};

export function buildSuccess<T>(params: BuildSuccessParams<T>): ApiResponse<T> {
  return {
    ok: true,
    data: params.data,
    message: params.message,
    meta: {
      source: params.source,
      requestId: params.requestId,
      timestamp: new Date().toISOString(),
      durationMs: Math.round(performance.now() - params.startedAt),
      pagination: params.pagination,
      extra: params.extra,
    },
  };
}

export function buildError(params: BuildErrorParams): ApiResponse<never> {
  const errorCategory =
    params.errorCategory ??
    (params.httpStatus ? classifyHttpStatus(params.httpStatus) : "UNKNOWN");

  return {
    ok: false,
    data: null,
    message: params.message,
    meta: {
      source: params.source,
      requestId: params.requestId,
      timestamp: new Date().toISOString(),
      durationMs: Math.round(performance.now() - params.startedAt),
      errorCategory,
      extra: params.extra,
    },
  };
}
