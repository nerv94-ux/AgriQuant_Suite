import { ApiError, type ApiClientConfig, type ApiRequestOptions } from "./types";

function buildUrl(baseUrl: string | undefined, path: string, query?: ApiRequestOptions["query"]) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, baseUrl ?? "http://local.api");

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return baseUrl ? url.toString() : `${url.pathname}${url.search}`;
}

function mergeHeaders(a?: HeadersInit, b?: HeadersInit): Headers {
  const headers = new Headers(a);
  new Headers(b).forEach((value, key) => headers.set(key, value));
  return headers;
}

export function createApiClient(config: ApiClientConfig = {}) {
  async function request<TResponse, TBody = unknown>(
    path: string,
    options: ApiRequestOptions<TBody> = {}
  ): Promise<TResponse> {
    const method = options.method ?? "GET";
    const url = buildUrl(config.baseUrl, path, options.query);
    const headers = mergeHeaders(config.defaultHeaders, options.headers);
    const hasBody = options.body !== undefined && method !== "GET";

    if (hasBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    const raw = await response.text();
    const payload = raw ? safeParseJson(raw) : null;

    if (!response.ok) {
      throw new ApiError(`API 요청에 실패했습니다. (${response.status})`, response.status, payload);
    }

    return payload as TResponse;
  }

  return {
    request,
    get: <TResponse>(path: string, options?: Omit<ApiRequestOptions, "method" | "body">) =>
      request<TResponse>(path, { ...options, method: "GET" }),
    post: <TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<ApiRequestOptions<TBody>, "method" | "body">) =>
      request<TResponse, TBody>(path, { ...options, method: "POST", body }),
    put: <TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<ApiRequestOptions<TBody>, "method" | "body">) =>
      request<TResponse, TBody>(path, { ...options, method: "PUT", body }),
    patch: <TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<ApiRequestOptions<TBody>, "method" | "body">) =>
      request<TResponse, TBody>(path, { ...options, method: "PATCH", body }),
    delete: <TResponse>(path: string, options?: Omit<ApiRequestOptions, "method" | "body">) =>
      request<TResponse>(path, { ...options, method: "DELETE" }),
  };
}

function safeParseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

