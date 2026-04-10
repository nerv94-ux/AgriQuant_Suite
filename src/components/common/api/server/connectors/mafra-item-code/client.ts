import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import {
  getMafraApiKey,
  loadMafraItemCodeCache,
  saveMafraItemCodeCache,
} from "../../admin/mafraItemCodeStore";
import type {
  MafraItemCode,
  MafraItemCodeSearchResponseData,
  MafraItemCodeSyncResponseData,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
/** 명세: `품목 코드.xls` — 계층·CSV 대조는 `docs/mafra-openapi-notes.md` */
const ITEM_CODE_API_URL = "Grid_20240626000000000668_1";
const CACHE_TTL_MS = 60 * 60 * 1000;
const PAGE_SIZE = 1000;

/** 관리자 API 로그용 — 긴 오류 문구 축약 */
function shortMessageForApiLog(full: string): string {
  const t = full.trim();
  if (t.includes("INFO-100")) return "INFO-100 품목코드 그리드 인증 실패 (포털 권한·DB 저장 키)";
  if (t.length > 200) return `${t.slice(0, 197)}…`;
  return t;
}

function itemRowFromRecord(item: Record<string, unknown>): MafraItemCode {
  return {
    LARGE: String(item.LARGE ?? ""),
    MID: String(item.MID ?? ""),
    SMALL: String(item.SMALL ?? ""),
    LARGENAME: String(item.LARGENAME ?? ""),
    MIDNAME: String(item.MIDNAME ?? ""),
    GOODNAME: String(item.GOODNAME ?? ""),
    GUBN: String(item.GUBN ?? ""),
  };
}

/** OpenAPI `row` 가 단일 객체로 오는 경우(엑셀 샘플·JSON 변환) 대비 */
function normalizeRows(value: unknown): MafraItemCode[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => itemRowFromRecord(row));
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
  rows: MafraItemCode[];
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

async function fetchItemCodesFromMafra(apiKey: string, requestId: string) {
  const startedAt = performance.now();
  const collected: MafraItemCode[] = [];
  let start = 1;
  let end = PAGE_SIZE;
  let totalCount = Number.POSITIVE_INFINITY;

  while (start <= totalCount) {
    const url = `${BASE_HOST}/${encodeURIComponent(apiKey)}/json/${ITEM_CODE_API_URL}/${start}/${end}`;
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();

    if (!res.ok) {
      return buildError({
        source: SOURCE,
        requestId,
        startedAt,
        httpStatus: res.status,
        message: `품목코드 API 호출 실패 (HTTP ${res.status})`,
      });
    }
    if (text.trim().startsWith("<")) {
      return buildError({
        source: SOURCE,
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.UNKNOWN,
        message: "품목코드 API가 XML로 응답했습니다. 현재는 JSON 호출만 허용합니다.",
      });
    }

    const payload = parsePayload(text);
    const gridOk =
      payload.code === "INFO-000" ||
      payload.code === "INFO-200" ||
      (payload.rows.length > 0 && payload.code !== "INFO-100" && !payload.code.startsWith("ERROR"));
    if (!gridOk) {
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
        message: [payload.code, payload.message].filter(Boolean).join(" ").trim() || "품목코드 API 오류",
      });
    }

    totalCount = payload.totalCount > 0 ? payload.totalCount : payload.rows.length;
    if (payload.rows.length === 0) {
      break;
    }
    collected.push(...payload.rows);
    if (collected.length >= totalCount || payload.rows.length < PAGE_SIZE) {
      break;
    }
    start += PAGE_SIZE;
    end += PAGE_SIZE;
  }

  const seen = new Set<string>();
  const activeRows = collected.filter((row) => {
    if (row.GUBN === "N") return false;
    const key = `${row.MID}|${row.SMALL}|${row.GOODNAME}|${row.MIDNAME}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return buildSuccess<MafraItemCode[]>({
    source: SOURCE,
    requestId,
    startedAt,
    data: activeRows,
    message: `품목코드 동기화 성공 (${activeRows.length}건)`,
  });
}

export async function syncMafraItemCodes(params: {
  requestId: string;
  appId?: string;
  updatedByEmail?: string | null;
}): Promise<ApiResponse<MafraItemCodeSyncResponseData>> {
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

  const fetched = await fetchItemCodesFromMafra(apiKey, params.requestId);
  if (!fetched.ok) {
    await saveApiLog({
      ok: false,
      meta: fetched.meta,
      appId: params.appId,
      message: shortMessageForApiLog(fetched.message),
    });
    return fetched as ApiResponse<MafraItemCodeSyncResponseData>;
  }

  await saveMafraItemCodeCache(fetched.data, params.updatedByEmail);
  const updatedAt = new Date().toISOString();
  const response = buildSuccess<MafraItemCodeSyncResponseData>({
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

export async function searchMafraItemCodes(params: {
  requestId: string;
  query: string;
  appId?: string;
  forceSync?: boolean;
}): Promise<ApiResponse<MafraItemCodeSearchResponseData>> {
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

  let cache = await loadMafraItemCodeCache();
  const cacheAge = cache.updatedAt ? Date.now() - new Date(cache.updatedAt).getTime() : Number.POSITIVE_INFINITY;
  if (params.forceSync || !cache.items.length || cacheAge > CACHE_TTL_MS) {
    const synced = await syncMafraItemCodes({
      requestId: `${params.requestId}-sync`,
      appId: "admin-mafra-item-codes-sync",
    });
    if (!synced.ok) {
      return synced as ApiResponse<MafraItemCodeSearchResponseData>;
    }
    cache = await loadMafraItemCodeCache();
  }

  const normalizedQuery = query.toLowerCase();
  const matches = cache.items
    .filter((row) => {
      const largeName = row.LARGENAME.toLowerCase();
      const midName = row.MIDNAME.toLowerCase();
      const goodName = row.GOODNAME.toLowerCase();
      return (
        largeName.includes(normalizedQuery) ||
        midName.includes(normalizedQuery) ||
        goodName.includes(normalizedQuery)
      );
    })
    .slice(0, 50);

  const response = buildSuccess<MafraItemCodeSearchResponseData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    message: `품목코드 검색 완료 (${matches.length}건)`,
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
