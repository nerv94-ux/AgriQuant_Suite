import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import {
  getMafraApiKey,
  loadMafraFrmlCodeCache,
  saveMafraFrmlCodeCache,
} from "../../admin/mafraItemCodeStore";
import type {
  MafraFrmlCode,
  MafraFrmlCodeListResponseData,
  MafraFrmlCodeSearchResponseData,
  MafraFrmlCodeSyncResponseData,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
const FRML_CODE_API_URL = "Grid_20240626000000000665_1";
const CACHE_TTL_MS = 60 * 60 * 1000;
const PAGE_SIZE = 1000;

function shortMessageForApiLog(full: string): string {
  const t = full.trim();
  if (t.includes("INFO-100")) return "INFO-100 포장코드 그리드 인증 실패 (포털 권한·DB 저장 키)";
  if (t.length > 200) return `${t.slice(0, 197)}…`;
  return t;
}

function normalizeRows(value: unknown): MafraFrmlCode[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      CODEID: String(item.CODEID ?? ""),
      CODENAME: String(item.CODENAME ?? ""),
    }));
}

function extractGridRowPayload(root: Record<string, unknown>): unknown {
  const keys = ["row", "rows", "data", "list", "items"] as const;
  for (const k of keys) {
    const v = root[k];
    if (v != null) return v;
  }
  return undefined;
}

function parsePayload(rawText: string): {
  code: string;
  message: string;
  totalCount: number;
  rows: MafraFrmlCode[];
} {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  const rootKey = Object.keys(parsed)[0];
  const root = (rootKey ? parsed[rootKey] : parsed) as Record<string, unknown>;
  const result = (root.result ?? (root as { RESULT?: Record<string, unknown> }).RESULT ?? {}) as Record<
    string,
    unknown
  >;
  const totalCnt = Number(root.totalCnt ?? root.total_cnt ?? 0);
  const codeRaw = result.code ?? result.CODE ?? root.code;
  let rows = normalizeRows(extractGridRowPayload(root));
  if (rows.length === 0) {
    rows = normalizeRows(root.row);
  }
  return {
    code: String(codeRaw ?? "").trim(),
    message: String(result.message ?? result.MESSAGE ?? ""),
    totalCount: Number.isFinite(totalCnt) ? totalCnt : 0,
    rows,
  };
}

async function fetchFrmlCodesFromMafra(apiKey: string, requestId: string) {
  const startedAt = performance.now();
  const collected: MafraFrmlCode[] = [];
  let start = 1;
  let totalCount = Number.POSITIVE_INFINITY;

  while (start <= totalCount) {
    const end = start + PAGE_SIZE - 1;
    const url = `${BASE_HOST}/${encodeURIComponent(apiKey)}/json/${FRML_CODE_API_URL}/${start}/${end}`;
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();

    if (!res.ok) {
      return buildError({
        source: SOURCE,
        requestId,
        startedAt,
        httpStatus: res.status,
        message: `포장코드 API 호출 실패 (HTTP ${res.status})`,
      });
    }
    if (text.trim().startsWith("<")) {
      return buildError({
        source: SOURCE,
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.UNKNOWN,
        message: "포장코드 API가 XML로 응답했습니다. 현재는 JSON 호출만 허용합니다.",
      });
    }

    const payload = parsePayload(text);
    const gridOk =
      payload.code === "INFO-000" ||
      payload.code === "INFO-200" ||
      (payload.rows.length > 0 && payload.code !== "INFO-100" && !payload.code.startsWith("ERROR"));
    if (!gridOk) {
      const apiMsg = [payload.code, payload.message].filter(Boolean).join(" ").trim();
      const authHint =
        payload.code === "INFO-100"
          ? " 품목·단위 동기화는 되어도 포장 그리드는 포털에서 별도 승인일 수 있습니다. data.garak.co.kr에서 「농축수산물 포장 코드」 사용 여부를 확인하세요."
          : "";
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
        message: apiMsg ? `${apiMsg}.${authHint}` : `포장코드 API 오류.${authHint}`,
      });
    }

    totalCount = payload.totalCount > 0 ? payload.totalCount : collected.length + payload.rows.length;
    if (payload.rows.length === 0) {
      break;
    }
    collected.push(...payload.rows);
    if (collected.length >= totalCount || payload.rows.length < PAGE_SIZE) {
      break;
    }
    start += PAGE_SIZE;
  }

  const seen = new Set<string>();
  const unique = collected.filter((row) => {
    if (!row.CODEID || seen.has(row.CODEID)) return false;
    seen.add(row.CODEID);
    return true;
  });

  return buildSuccess<MafraFrmlCode[]>({
    source: SOURCE,
    requestId,
    startedAt,
    data: unique,
    message: `포장코드 동기화 성공 (${unique.length}건)`,
  });
}

export async function syncMafraFrmlCodes(params: {
  requestId: string;
  appId?: string;
  updatedByEmail?: string | null;
}): Promise<ApiResponse<MafraFrmlCodeSyncResponseData>> {
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

  const fetched = await fetchFrmlCodesFromMafra(apiKey, params.requestId);
  if (!fetched.ok) {
    await saveApiLog({
      ok: false,
      meta: fetched.meta,
      appId: params.appId,
      message: shortMessageForApiLog(fetched.message),
    });
    return fetched as ApiResponse<MafraFrmlCodeSyncResponseData>;
  }

  await saveMafraFrmlCodeCache(fetched.data, params.updatedByEmail);
  const updatedAt = new Date().toISOString();
  const response = buildSuccess<MafraFrmlCodeSyncResponseData>({
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

export async function searchMafraFrmlCodes(params: {
  requestId: string;
  query: string;
  appId?: string;
  forceSync?: boolean;
}): Promise<ApiResponse<MafraFrmlCodeSearchResponseData>> {
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

  let cache = await loadMafraFrmlCodeCache();
  const cacheAge = cache.updatedAt ? Date.now() - new Date(cache.updatedAt).getTime() : Number.POSITIVE_INFINITY;
  if (params.forceSync || !cache.items.length || cacheAge > CACHE_TTL_MS) {
    const synced = await syncMafraFrmlCodes({
      requestId: `${params.requestId}-sync`,
      appId: "admin-mafra-frml-codes-sync",
    });
    if (!synced.ok) {
      return synced as ApiResponse<MafraFrmlCodeSearchResponseData>;
    }
    cache = await loadMafraFrmlCodeCache();
  }

  const normalizedQuery = query.toLowerCase();
  const matches = cache.items
    .filter((row) => {
      const id = row.CODEID.toLowerCase();
      const name = row.CODENAME.toLowerCase();
      return id.includes(normalizedQuery) || name.includes(normalizedQuery);
    })
    .slice(0, 50);

  const response = buildSuccess<MafraFrmlCodeSearchResponseData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    message: `포장코드 검색 완료 (${matches.length}건)`,
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

/**
 * 데스크에서 포장 CODEID 전체 목록을 드롭다운으로 고르게 할 때 사용합니다.
 */
export async function listMafraFrmlCodes(params: {
  requestId: string;
  appId?: string;
  forceSync?: boolean;
}): Promise<ApiResponse<MafraFrmlCodeListResponseData>> {
  const startedAt = performance.now();

  let cache = await loadMafraFrmlCodeCache();
  const cacheAge = cache.updatedAt ? Date.now() - new Date(cache.updatedAt).getTime() : Number.POSITIVE_INFINITY;
  const needsRefresh = params.forceSync || !cache.items.length || cacheAge > CACHE_TTL_MS;

  if (needsRefresh) {
    const synced = await syncMafraFrmlCodes({
      requestId: `${params.requestId}-sync`,
      appId: params.appId ?? "desk-mafra-frml-codes-list",
    });
    if (!synced.ok) {
      if (cache.items.length > 0) {
        const staleItems = [...cache.items].sort((a, b) => {
          const na = a.CODENAME.localeCompare(b.CODENAME, "ko");
          if (na !== 0) return na;
          return a.CODEID.localeCompare(b.CODEID, "ko", { numeric: true });
        });
        const staleResponse = buildSuccess<MafraFrmlCodeListResponseData>({
          source: SOURCE,
          requestId: params.requestId,
          startedAt,
          message: `최신 동기화에 실패했습니다. 이전에 저장된 포장 ${staleItems.length}건을 표시합니다. (${synced.message})`,
          data: {
            updatedAt: cache.updatedAt,
            total: staleItems.length,
            items: staleItems,
          },
        });
        await saveApiLog({
          ok: true,
          meta: staleResponse.meta,
          appId: params.appId,
          message: `동기화 실패, 캐시 ${staleItems.length}건 표시 · ${shortMessageForApiLog(synced.message ?? "")}`,
        });
        return staleResponse;
      }
      return synced as ApiResponse<MafraFrmlCodeListResponseData>;
    }
    cache = await loadMafraFrmlCodeCache();
  }

  const items = [...cache.items].sort((a, b) => {
    const na = a.CODENAME.localeCompare(b.CODENAME, "ko");
    if (na !== 0) return na;
    return a.CODEID.localeCompare(b.CODEID, "ko", { numeric: true });
  });

  const response = buildSuccess<MafraFrmlCodeListResponseData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    message: `포장코드 ${items.length}건`,
    data: {
      updatedAt: cache.updatedAt,
      total: items.length,
      items,
    },
  });
  await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
  return response;
}
