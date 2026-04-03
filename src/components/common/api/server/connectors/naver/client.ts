import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import { getNaverRuntimeConfig } from "../../admin/providerSettings";
import type {
  NaverDatalabSearchTrendRequest,
  NaverDatalabSearchTrendResponseData,
  NaverDatalabShoppingInsightRequest,
  NaverDatalabShoppingInsightResponseData,
  NaverHealthResponseData,
  NaverSearchResponseData,
} from "./types";

const SOURCE = "NAVER" as const;
const BASE_URL = "https://openapi.naver.com";
const DEFAULT_TIMEOUT_MS = 10_000;

function buildNaverHeaders(params: { clientId: string; clientSecret: string }) {
  return {
    "X-Naver-Client-Id": params.clientId,
    "X-Naver-Client-Secret": params.clientSecret,
    "Content-Type": "application/json",
  };
}

function toDateString(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return "";
}

function shiftDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseJsonSafe<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function normalizeSearchItems(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
}

export async function callNaverSearch(params: {
  requestId: string;
  query: string;
  display?: number;
  start?: number;
  sort?: "sim" | "date";
  timeoutMs?: number;
  appId?: string;
}): Promise<ApiResponse<NaverSearchResponseData>> {
  const startedAt = performance.now();
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runtimeConfig = await getNaverRuntimeConfig();
  const credentials = {
    clientId: runtimeConfig.clientId ?? "",
    clientSecret: runtimeConfig.clientSecret ?? "",
  };

  if (!credentials.clientId || !credentials.clientSecret) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const query = params.query.trim();
  if (!query) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "검색어(query)를 입력해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const display = Math.min(100, Math.max(1, Math.round(params.display ?? 10)));
  const start = Math.min(1000, Math.max(1, Math.round(params.start ?? 1)));
  const sort = params.sort === "date" ? "date" : "sim";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const search = new URLSearchParams({
      query,
      display: String(display),
      start: String(start),
      sort,
    });
    const url = `${BASE_URL}/v1/search/shop.json?${search.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: buildNaverHeaders(credentials),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const parsed = parseJsonSafe<{ errorMessage?: string }>(text);
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: res.status,
        message: parsed?.errorMessage || `네이버 검색 API 호출 실패 (HTTP ${res.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    const payload = parseJsonSafe<{
      total?: number;
      start?: number;
      display?: number;
      items?: unknown;
    }>(text);

    const response = buildSuccess<NaverSearchResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message: "네이버 검색 API 호출 성공",
      data: {
        total: typeof payload?.total === "number" ? payload.total : 0,
        start: typeof payload?.start === "number" ? payload.start : start,
        display: typeof payload?.display === "number" ? payload.display : display,
        items: normalizeSearchItems(payload?.items),
      },
    });
    await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
      message: isTimeout
        ? `네이버 검색 API 요청 시간 초과 (${timeoutMs}ms)`
        : error instanceof Error
          ? error.message
          : "네이버 검색 API 호출 중 네트워크 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function callNaverDatalabSearchTrend(params: {
  requestId: string;
  request: NaverDatalabSearchTrendRequest;
  timeoutMs?: number;
  appId?: string;
}): Promise<ApiResponse<NaverDatalabSearchTrendResponseData>> {
  const startedAt = performance.now();
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runtimeConfig = await getNaverRuntimeConfig();
  const credentials = {
    clientId: runtimeConfig.clientId ?? "",
    clientSecret: runtimeConfig.clientSecret ?? "",
  };

  if (!credentials.clientId || !credentials.clientSecret) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const startDate = toDateString(params.request.startDate);
  const endDate = toDateString(params.request.endDate);
  const timeUnit = params.request.timeUnit;
  const keywordGroups = params.request.keywordGroups.filter(
    (group) => group.groupName.trim() && group.keywords.some((keyword) => keyword.trim())
  );

  if (!startDate || !endDate || !["date", "week", "month"].includes(timeUnit)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "검색어 트렌드 요청값이 올바르지 않습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
  if (keywordGroups.length === 0) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "검색어 그룹을 1개 이상 입력해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/v1/datalab/search`, {
      method: "POST",
      headers: buildNaverHeaders(credentials),
      body: JSON.stringify({ startDate, endDate, timeUnit, keywordGroups }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const parsed = parseJsonSafe<{ errorMessage?: string }>(text);
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: res.status,
        message: parsed?.errorMessage || `네이버 데이터랩(검색어트렌드) 호출 실패 (HTTP ${res.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    const payload = parseJsonSafe<NaverDatalabSearchTrendResponseData>(text);
    if (!payload) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: ApiErrorCategory.UNKNOWN,
        message: "검색어 트렌드 응답 파싱에 실패했습니다.",
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    const response = buildSuccess<NaverDatalabSearchTrendResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message: "네이버 데이터랩(검색어트렌드) 호출 성공",
      data: payload,
    });
    await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
      message: isTimeout
        ? `네이버 데이터랩(검색어트렌드) 요청 시간 초과 (${timeoutMs}ms)`
        : error instanceof Error
          ? error.message
          : "네이버 데이터랩(검색어트렌드) 호출 중 네트워크 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function callNaverDatalabShoppingInsight(params: {
  requestId: string;
  request: NaverDatalabShoppingInsightRequest;
  timeoutMs?: number;
  appId?: string;
}): Promise<ApiResponse<NaverDatalabShoppingInsightResponseData>> {
  const startedAt = performance.now();
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runtimeConfig = await getNaverRuntimeConfig();
  const credentials = {
    clientId: runtimeConfig.clientId ?? "",
    clientSecret: runtimeConfig.clientSecret ?? "",
  };

  if (!credentials.clientId || !credentials.clientSecret) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const startDate = toDateString(params.request.startDate);
  const endDate = toDateString(params.request.endDate);
  const timeUnit = params.request.timeUnit;
  const category = params.request.category.filter(
    (item) => item.name.trim() && Array.isArray(item.param) && item.param.some((code) => code.trim())
  );

  if (!startDate || !endDate || !["date", "week", "month"].includes(timeUnit)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "쇼핑인사이트 요청값이 올바르지 않습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
  if (category.length === 0) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "쇼핑 카테고리를 1개 이상 입력해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/v1/datalab/shopping/categories`, {
      method: "POST",
      headers: buildNaverHeaders(credentials),
      body: JSON.stringify({ startDate, endDate, timeUnit, category }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const parsed = parseJsonSafe<{ errorMessage?: string }>(text);
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: res.status,
        message: parsed?.errorMessage || `네이버 데이터랩(쇼핑인사이트) 호출 실패 (HTTP ${res.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    const payload = parseJsonSafe<NaverDatalabShoppingInsightResponseData>(text);
    if (!payload) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: ApiErrorCategory.UNKNOWN,
        message: "쇼핑인사이트 응답 파싱에 실패했습니다.",
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    const response = buildSuccess<NaverDatalabShoppingInsightResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message: "네이버 데이터랩(쇼핑인사이트) 호출 성공",
      data: payload,
    });
    await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
      message: isTimeout
        ? `네이버 데이터랩(쇼핑인사이트) 요청 시간 초과 (${timeoutMs}ms)`
        : error instanceof Error
          ? error.message
          : "네이버 데이터랩(쇼핑인사이트) 호출 중 네트워크 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function callNaverHealthCheck(params: {
  requestId: string;
  timeoutMs?: number;
  appId?: string;
}): Promise<ApiResponse<NaverHealthResponseData>> {
  const startedAt = performance.now();
  const endDate = shiftDate(0);
  const startDate = shiftDate(-30);
  const [search, trend, shopping] = await Promise.all([
    callNaverSearch({
      requestId: `${params.requestId}-search`,
      timeoutMs: params.timeoutMs,
      appId: "admin-health-check-search",
      query: "농산물",
      display: 5,
      start: 1,
    }),
    callNaverDatalabSearchTrend({
      requestId: `${params.requestId}-trend`,
      timeoutMs: params.timeoutMs,
      appId: "admin-health-check-trend",
      request: {
        startDate,
        endDate,
        timeUnit: "week",
        keywordGroups: [{ groupName: "농산물", keywords: ["농산물", "농산물 가격"] }],
      },
    }),
    callNaverDatalabShoppingInsight({
      requestId: `${params.requestId}-shopping`,
      timeoutMs: params.timeoutMs,
      appId: "admin-health-check-shopping",
      request: {
        startDate,
        endDate,
        timeUnit: "week",
        category: [{ name: "식품", param: ["50000006"] }],
      },
    }),
  ]);

  if (!search.ok) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: `검색 API 연결 확인 실패: ${search.message}`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
  if (!trend.ok) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: `데이터랩(검색어트렌드) 연결 확인 실패: ${trend.message}`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
  if (!shopping.ok) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: `데이터랩(쇼핑인사이트) 연결 확인 실패: ${shopping.message}`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const response = buildSuccess<NaverHealthResponseData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    message: "네이버 검색/데이터랩 연결 확인에 성공했습니다.",
    data: {
      searchTotal: search.data.total,
      trendSeriesCount: trend.data.results.length,
      shoppingSeriesCount: shopping.data.results.length,
    },
  });
  await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
  return response;
}
