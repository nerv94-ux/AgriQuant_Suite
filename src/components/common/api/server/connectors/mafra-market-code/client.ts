import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import {
  getMafraApiKey,
  loadMafraMarketCodeCache,
  saveMafraMarketCodeCache,
} from "../../admin/mafraItemCodeStore";
import type {
  MafraMarketCode,
  MafraMarketCodeSearchResponseData,
  MafraMarketCodeSyncResponseData,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
const MARKET_CODE_API_URL = "Grid_20240625000000000661_1";
const CACHE_TTL_MS = 60 * 60 * 1000;

function normalizeRows(value: unknown): MafraMarketCode[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      CODEID: String(item.CODEID ?? ""),
      CODENAME: String(item.CODENAME ?? ""),
    }));
}

function parsePayload(rawText: string): {
  code: string;
  message: string;
  rows: MafraMarketCode[];
} {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  const rootKey = Object.keys(parsed)[0];
  const root = (rootKey ? parsed[rootKey] : parsed) as Record<string, unknown>;
  const result = (root.result ?? {}) as Record<string, unknown>;
  return {
    code: String(result.code ?? ""),
    message: String(result.message ?? ""),
    rows: normalizeRows(root.row),
  };
}

async function fetchMarketCodesFromMafra(apiKey: string, requestId: string) {
  const startedAt = performance.now();
  const url = `${BASE_HOST}/${encodeURIComponent(apiKey)}/json/${MARKET_CODE_API_URL}/1/1000`;
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();

  if (!res.ok) {
    return buildError({
      source: SOURCE,
      requestId,
      startedAt,
      httpStatus: res.status,
      message: `도매시장코드 API 호출 실패 (HTTP ${res.status})`,
    });
  }
  if (text.trim().startsWith("<")) {
    return buildError({
      source: SOURCE,
      requestId,
      startedAt,
      errorCategory: ApiErrorCategory.UNKNOWN,
      message: "도매시장코드 API가 XML로 응답했습니다. 현재는 JSON 호출만 허용합니다.",
    });
  }

  const payload = parsePayload(text);
  if (payload.code !== "INFO-000" && payload.code !== "INFO-200") {
    return buildError({
      source: SOURCE,
      requestId,
      startedAt,
      errorCategory:
        payload.code === "INFO-100"
          ? ApiErrorCategory.AUTH_ERROR
          : payload.code === "ERROR-350"
            ? ApiErrorCategory.RATE_LIMIT
            : ApiErrorCategory.VALIDATION_ERROR,
      message: `${payload.code} ${payload.message}`,
    });
  }

  return buildSuccess<MafraMarketCode[]>({
    source: SOURCE,
    requestId,
    startedAt,
    data: payload.rows,
    message: `도매시장코드 동기화 성공 (${payload.rows.length}건)`,
  });
}

export async function syncMafraMarketCodes(params: {
  requestId: string;
  appId?: string;
  updatedByEmail?: string | null;
}): Promise<ApiResponse<MafraMarketCodeSyncResponseData>> {
  const startedAt = performance.now();
  const apiKey = await getMafraApiKey();
  if (!apiKey) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: "MAFRA_API_KEY가 설정되지 않았습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const fetched = await fetchMarketCodesFromMafra(apiKey, params.requestId);
  if (!fetched.ok) {
    await saveApiLog({ ok: false, meta: fetched.meta, appId: params.appId, message: fetched.message });
    return fetched as ApiResponse<MafraMarketCodeSyncResponseData>;
  }

  await saveMafraMarketCodeCache(fetched.data, params.updatedByEmail);
  const updatedAt = new Date().toISOString();
  const response = buildSuccess<MafraMarketCodeSyncResponseData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    message: fetched.message,
    data: {
      syncedCount: fetched.data.length,
      updatedAt,
    },
  });
  await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
  return response;
}

export async function searchMafraMarketCodes(params: {
  requestId: string;
  query: string;
  appId?: string;
  forceSync?: boolean;
}): Promise<ApiResponse<MafraMarketCodeSearchResponseData>> {
  const startedAt = performance.now();
  const query = params.query.trim();
  if (!query) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "query를 입력해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  let cache = await loadMafraMarketCodeCache();
  const cacheAge = cache.updatedAt ? Date.now() - new Date(cache.updatedAt).getTime() : Number.POSITIVE_INFINITY;
  if (params.forceSync || !cache.items.length || cacheAge > CACHE_TTL_MS) {
    const synced = await syncMafraMarketCodes({
      requestId: `${params.requestId}-sync`,
      appId: "admin-mafra-market-codes-sync",
    });
    if (!synced.ok) {
      return synced as ApiResponse<MafraMarketCodeSearchResponseData>;
    }
    cache = await loadMafraMarketCodeCache();
  }

  const normalizedQuery = query.toLowerCase();
  const matches = cache.items
    .filter((row) => {
      const id = row.CODEID.toLowerCase();
      const name = row.CODENAME.toLowerCase();
      return id.includes(normalizedQuery) || name.includes(normalizedQuery);
    })
    .slice(0, 50);

  const response = buildSuccess<MafraMarketCodeSearchResponseData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    message: `도매시장코드 검색 완료 (${matches.length}건)`,
    data: {
      query,
      updatedAt: cache.updatedAt,
      totalCached: cache.items.length,
      matches,
    },
  });
  await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
  return response;
}
