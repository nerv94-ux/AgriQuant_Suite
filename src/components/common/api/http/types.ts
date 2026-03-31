export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiRequestOptions<TBody = unknown> = {
  method?: ApiMethod;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: TBody;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export type ApiClientConfig = {
  baseUrl?: string;
  defaultHeaders?: HeadersInit;
};

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

