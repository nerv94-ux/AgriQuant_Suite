import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { getEcoPriceRuntimeConfig } from "../../admin/providerSettings";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import type {
  EcoPriceApiRawResponse,
  EcoPriceProductListRequest,
  EcoPriceProductListResponseData,
} from "./types";

const SOURCE = "ECO_PRICE" as const;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETURN_TYPE = "JSON";
const ENV_API_URL = process.env.ECO_PRICE_API_URL?.trim() ?? "";

type CallEcoPriceProductListParams = {
  requestId: string;
  request: EcoPriceProductListRequest;
  timeoutMs?: number;
  appId?: string;
};

type CallEcoPriceHealthCheckParams = {
  requestId: string;
  timeoutMs?: number;
  appId?: string;
};

function parseTotalCount(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function normalizeItems(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    );
  }
  if (value && typeof value === "object") {
    return [value as Record<string, unknown>];
  }
  return [];
}

function todayYmd() {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function daysAgoYmd(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function collectResultCode(raw: EcoPriceApiRawResponse) {
  return (
    raw.response?.header?.resultCode ??
    raw.header?.resultCode ??
    raw.resultCode ??
    "00"
  );
}

function isSuccessResultCode(value: unknown) {
  const code = String(value ?? "").trim();
  return code === "00" || code === "0";
}

function collectResultMsg(raw: EcoPriceApiRawResponse) {
  return (
    raw.response?.header?.resultMsg ??
    raw.header?.resultMsg ??
    raw.resultMsg ??
    "OK"
  );
}

function collectItems(raw: EcoPriceApiRawResponse) {
  const nested = raw.response?.body?.items;
  if (Array.isArray(nested)) {
    return normalizeItems(nested);
  }
  if (nested && typeof nested === "object" && "item" in nested) {
    return normalizeItems((nested as { item?: unknown }).item);
  }
  if (raw.body?.items) {
    return normalizeItems(raw.body.items);
  }
  if (raw.data) {
    return normalizeItems(raw.data);
  }
  return [];
}

function collectTotalCount(raw: EcoPriceApiRawResponse, itemCount: number) {
  return parseTotalCount(
    raw.response?.body?.totalCount ?? raw.body?.totalCount ?? raw.totalCount,
    itemCount
  );
}

function addCond(search: URLSearchParams, key: string, value?: string) {
  const trimmed = value?.trim() ?? "";
  if (trimmed) {
    search.set(key, trimmed);
  }
}

function buildRequestUrl(baseUrl: string, search: URLSearchParams) {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${search.toString()}`;
}

function buildServiceKeyCandidates(value: string) {
  const raw = value.trim();
  const list: string[] = [];
  if (raw) {
    list.push(raw);
  }
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded && !list.includes(decoded)) {
      list.push(decoded);
    }
  } catch {
    // ignore decode errors
  }
  return list;
}

function looksLikeRootOnlyEcoUrl(value: string) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    // e.g. /B552845/ecoFriendly (루트) -> 기능 경로가 1단계 더 필요
    if (parts.length === 2 && parts[1].toLowerCase() === "ecofriendly") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function buildApiUrlCandidates(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  const candidates = [trimmed];
  if (looksLikeRootOnlyEcoUrl(trimmed)) {
    candidates.unshift(`${trimmed}/price`);
  }
  return [...new Set(candidates)];
}

export async function callEcoPriceProductList(
  params: CallEcoPriceProductListParams
): Promise<ApiResponse<EcoPriceProductListResponseData>> {
  const startedAt = performance.now();
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runtime = await getEcoPriceRuntimeConfig();

  if (!runtime.enabled) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.DISABLED,
      message: "친환경 가격 커넥터가 관리자 설정에서 비활성화되어 있습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  if (!runtime.serviceKey) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: "ECO_PRICE_SERVICE_KEY가 설정되지 않았습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const apiUrl = runtime.apiUrl || ENV_API_URL;
  if (!apiUrl) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "친환경 가격 API URL이 설정되지 않았습니다. 관리자 설정에서 API URL을 입력해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  if (apiUrl.includes("data.go.kr/data/")) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message:
        "현재 입력한 URL은 데이터 소개 페이지입니다. API 호출 주소(https://apis.data.go.kr/... 형태)를 입력해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const apiUrlCandidates = buildApiUrlCandidates(apiUrl);

  const pageNo = Math.max(1, Math.round(params.request.pageNo ?? runtime.pageNo));
  const numOfRows = Math.min(100, Math.max(1, Math.round(params.request.numOfRows ?? runtime.numOfRows)));
  const fromDate = (params.request.fromDate || runtime.fromDate || daysAgoYmd(7)).trim();
  const toDate = (params.request.toDate || runtime.toDate || todayYmd()).trim();

  if (!/^\d{8}$/.test(fromDate) || !/^\d{8}$/.test(toDate)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "조회 기간은 YYYYMMDD 형식이어야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const from = new Date(Number(fromDate.slice(0, 4)), Number(fromDate.slice(4, 6)) - 1, Number(fromDate.slice(6, 8)));
  const to = new Date(Number(toDate.slice(0, 4)), Number(toDate.slice(4, 6)) - 1, Number(toDate.slice(6, 8)));
  const spanDays = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (!Number.isFinite(spanDays) || spanDays < 0) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "시작일은 종료일보다 이후일 수 없습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
  if (spanDays > 30) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "조회 기간은 최대 30일까지 허용됩니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const serviceKeys = buildServiceKeyCandidates(runtime.serviceKey);
  const makeSearch = (options: { key: string; withCond: boolean; returnTypeMode: "none" | "returnType" | "_type" | "both" }) => {
    const search = new URLSearchParams({
      serviceKey: options.key,
      pageNo: String(pageNo),
      numOfRows: String(numOfRows),
    });
    if (options.returnTypeMode === "returnType" || options.returnTypeMode === "both") {
      search.set("returnType", DEFAULT_RETURN_TYPE);
    }
    if (options.returnTypeMode === "_type" || options.returnTypeMode === "both") {
      search.set("_type", "json");
    }
    if (options.withCond) {
      search.set("cond[exmn_ymd::GTE]", fromDate);
      search.set("cond[exmn_ymd::LTE]", toDate);
      addCond(search, "cond[ctgry_cd::EQ]", params.request.ctgryCd);
      addCond(search, "cond[item_cd::EQ]", params.request.itemCd);
      addCond(search, "cond[vrty_cd::EQ]", params.request.vrtyCd);
      addCond(search, "cond[grd_cd::EQ]", params.request.grdCd);
      addCond(search, "cond[sgg_cd::EQ]", params.request.sggCd);
      addCond(search, "cond[mrkt_cd::EQ]", params.request.mrktCd);
    }
    return search;
  };

  const attempts = serviceKeys.flatMap((key) => [
    { name: "cond+both", search: makeSearch({ key, withCond: true, returnTypeMode: "both" }) },
    { name: "no-cond+both", search: makeSearch({ key, withCond: false, returnTypeMode: "both" }) },
    { name: "no-cond+_type", search: makeSearch({ key, withCond: false, returnTypeMode: "_type" }) },
    { name: "no-cond+returnType", search: makeSearch({ key, withCond: false, returnTypeMode: "returnType" }) },
    { name: "no-cond+none", search: makeSearch({ key, withCond: false, returnTypeMode: "none" }) },
  ]);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let lastFailure = "응답 없음";
    let lastHttpStatus: number | undefined;

    for (const apiBase of apiUrlCandidates) {
      for (const attempt of attempts) {
        const requestUrl = buildRequestUrl(apiBase, attempt.search);
        const res = await fetch(requestUrl, {
          method: "GET",
          signal: controller.signal,
        });

        if (!res.ok) {
          const responseText = await res.text().catch(() => "");
          const detail = responseText.trim().slice(0, 220);
          lastHttpStatus = res.status;
          lastFailure = detail || `HTTP ${res.status}`;
          continue;
        }

        const raw = (await res.json()) as EcoPriceApiRawResponse;
        const resultCode = collectResultCode(raw);
        const resultMsg = collectResultMsg(raw);
        if (!isSuccessResultCode(resultCode)) {
          lastFailure = `ECO_PRICE(${resultCode}) ${resultMsg}`;
          continue;
        }

        const items = collectItems(raw);
        const totalCount = collectTotalCount(raw, items.length);
        const response = buildSuccess<EcoPriceProductListResponseData>({
          source: SOURCE,
          requestId: params.requestId,
          startedAt,
          data: {
            totalCount,
            items,
          },
          message: `친환경 가격 조회 성공 (${items.length}건)`,
          extra: {
            pageNo,
            numOfRows,
            fromDate,
            toDate,
            apiBase,
            attempt: attempt.name,
          },
        });
        await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
        return response;
      }
    }

    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      httpStatus: lastHttpStatus,
      message: `친환경 가격 API 호출 실패 - ${lastFailure}`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
      message: isTimeout
        ? `친환경 가격 API 요청 시간 초과 (${timeoutMs}ms)`
        : error instanceof Error
          ? error.message
          : "친환경 가격 API 호출 중 네트워크 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function callEcoPriceHealthCheck(
  params: CallEcoPriceHealthCheckParams
): Promise<ApiResponse<{ totalCount: number }>> {
  const runtime = await getEcoPriceRuntimeConfig();
  const result = await callEcoPriceProductList({
    requestId: params.requestId,
    timeoutMs: params.timeoutMs,
    appId: params.appId,
    request: {
      fromDate: runtime.fromDate || daysAgoYmd(7),
      toDate: runtime.toDate || todayYmd(),
      pageNo: runtime.pageNo,
      numOfRows: runtime.numOfRows,
    },
  });

  if (!result.ok || !result.data) {
    return result as ApiResponse<{ totalCount: number }>;
  }

  return buildSuccess<{ totalCount: number }>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt: performance.now(),
    data: { totalCount: result.data.totalCount },
    message: `친환경 가격 API 연결 확인 성공 (${result.data.totalCount}건)`,
  });
}
