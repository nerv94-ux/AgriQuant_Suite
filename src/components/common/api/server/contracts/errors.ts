export const ApiErrorCategory = {
  AUTH_ERROR: "AUTH_ERROR",
  RATE_LIMIT: "RATE_LIMIT",
  TIMEOUT: "TIMEOUT",
  DISABLED: "DISABLED",
  UPSTREAM_5XX: "UPSTREAM_5XX",
  NETWORK_ERROR: "NETWORK_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNKNOWN: "UNKNOWN",
} as const;

export type ApiErrorCategory = (typeof ApiErrorCategory)[keyof typeof ApiErrorCategory];

export function classifyHttpStatus(status: number): ApiErrorCategory {
  if (status === 401 || status === 403) return ApiErrorCategory.AUTH_ERROR;
  if (status === 429) return ApiErrorCategory.RATE_LIMIT;
  if (status >= 500) return ApiErrorCategory.UPSTREAM_5XX;
  if (status === 400 || status === 422) return ApiErrorCategory.VALIDATION_ERROR;
  return ApiErrorCategory.UNKNOWN;
}
