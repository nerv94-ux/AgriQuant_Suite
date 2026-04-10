/**
 * 농축수산물 단위 코드 (aT 기초코드 OpenAPI).
 * 명세·샘플: `Grid_20240626000000000664_1`, 호스트 `http://211.237.50.150:7080/openapi`
 * 인증: 품목·도매시장·경매 등과 동일 `getMafraApiKey()` → DB `MAFRA_API_KEY` 또는 `process.env.MAFRA_API_KEY`
 * 실제 호출: `/{API_KEY}/json/{Grid...}/{시작}/{끝}` (엑셀의 sample/xml/1~5는 시험용)
 */
import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import {
  getMafraApiKey,
  loadMafraUnitCodeCache,
  saveMafraUnitCodeCache,
} from "../../admin/mafraItemCodeStore";
import type {
  MafraUnitCode,
  MafraUnitCodeListResponseData,
  MafraUnitCodeSearchResponseData,
  MafraUnitCodeSyncResponseData,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
const UNIT_CODE_API_URL = "Grid_20240626000000000664_1";
const CACHE_TTL_MS = 60 * 60 * 1000;
const PAGE_SIZE = 1000;

/** 관리자 API 로그·센터 목록용 — 응답 message와 분리해 짧게 남긴다 */
function shortMessageForApiLog(full: string): string {
  const t = full.trim();
  if (t.includes("INFO-100")) {
    return "INFO-100 단위코드 그리드 인증 실패 (포털 권한·DB 저장 키 확인)";
  }
  if (t.length > 200) return `${t.slice(0, 197)}…`;
  return t;
}

function compactAlnum(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/** 영문·한글 단위 표기 차이를 줄이기 위한 검색 바늘(부분 일치) */
function buildUnitSearchNeedles(raw: string): string[] {
  const q = raw.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const set = new Set<string>([lower, q]);

  if (lower === "kg" || lower === "k.g" || lower === "kilo" || lower === "kilogram") {
    ["킬로그램", "킬로", "kg", "k g", "k.g"].forEach((s) => set.add(s.toLowerCase()));
  }
  if (lower === "g" && q.length === 1) {
    ["그램", "g"].forEach((s) => set.add(s.toLowerCase()));
  }
  if (lower === "t" || lower === "ton" || lower === "mt") {
    ["톤", "미터톤", "t"].forEach((s) => set.add(s.toLowerCase()));
  }

  return [...set].filter((s) => s.length > 0);
}

function rowMatchesUnitNeedles(row: MafraUnitCode, needles: string[]): boolean {
  const idRaw = row.CODEID;
  const nameRaw = row.CODENAME;
  const id = idRaw.toLowerCase();
  const name = nameRaw.toLowerCase();
  const idC = compactAlnum(idRaw);
  const nameC = compactAlnum(nameRaw);

  for (const needle of needles) {
    const n = needle.toLowerCase();
    if (!n) continue;
    if (id.includes(n) || name.includes(n)) return true;
    const nc = compactAlnum(needle);
    if (nc.length >= 1 && (idC.includes(nc) || nameC.includes(nc))) return true;
  }
  return false;
}

/** 표준코드 API마다 컬럼명이 CODEID/CODENAME 이 아닐 수 있음(UNIT_CD, DAN_CD 등) */
function inferCodeNameFromEntries(item: Record<string, unknown>): { code: string; name: string } {
  let code = "";
  let name = "";
  for (const [k, v] of Object.entries(item)) {
    if (v == null || v === "") continue;
    const ku = k.toUpperCase();
    const s = String(v).trim();
    if (!s || ku === "ROW_NUM" || ku === "RNUM" || ku.includes("ROWNUM")) continue;
    if (!code && (ku.endsWith("CD") || ku.includes("CODEID") || ku.includes("CODE_ID") || ku === "CODE")) {
      code = s;
    } else if (!name && (ku.includes("NAME") || ku.endsWith("NM") || ku === "NM")) {
      name = s;
    }
  }
  return { code, name };
}

function unitRowFromRecord(item: Record<string, unknown>): MafraUnitCode {
  const id =
    item.CODEID ??
    item.codeId ??
    item.CodeId ??
    item.CODE_ID ??
    item.UNIT_CD ??
    item.UNITCD ??
    item.DAN_CD ??
    item.DANCD ??
    item.STD_UNIT_CD ??
    item.CODE;
  const name =
    item.CODENAME ??
    item.codeName ??
    item.CodeName ??
    item.NAME ??
    item.UNIT_NM ??
    item.UNITNM ??
    item.DAN_NM ??
    item.DANNM ??
    item.STD_UNIT_NM ??
    item.NM;

  let CODEID = String(id ?? "").trim();
  let CODENAME = String(name ?? "").trim();
  if (!CODEID || !CODENAME) {
    const inferred = inferCodeNameFromEntries(item);
    if (!CODEID) CODEID = inferred.code;
    if (!CODENAME) CODENAME = inferred.name;
  }
  return { CODEID, CODENAME };
}

/** OpenAPI `row` 가 배열이 아니라 단일 객체로 오는 경우가 있어 품목코드와 같이 정규화 */
function normalizeRows(value: unknown): MafraUnitCode[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => unitRowFromRecord(item))
    .filter((r) => r.CODEID.length > 0);
}

/** `row` / `rows` / `data` 등 그리드 본문이 오는 위치를 순차 시도 */
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
  rows: MafraUnitCode[];
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

async function fetchUnitCodesFromMafra(apiKey: string, requestId: string) {
  const startedAt = performance.now();
  const collected: MafraUnitCode[] = [];
  let start = 1;
  let totalCount = Number.POSITIVE_INFINITY;

  while (start <= totalCount) {
    const end = start + PAGE_SIZE - 1;
    const url = `${BASE_HOST}/${encodeURIComponent(apiKey)}/json/${UNIT_CODE_API_URL}/${start}/${end}`;
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();

    if (!res.ok) {
      return buildError({
        source: SOURCE,
        requestId,
        startedAt,
        httpStatus: res.status,
        message: `단위코드 API 호출 실패 (HTTP ${res.status})`,
      });
    }
    if (text.trim().startsWith("<")) {
      return buildError({
        source: SOURCE,
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.UNKNOWN,
        message: "단위코드 API가 XML로 응답했습니다. 현재는 JSON 호출만 허용합니다.",
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
          ? " 단위코드는 경매·정산과 다른 그리드라 포털(data.garak.co.kr)에서 권한이 따로 필요할 수 있습니다. 관리자 MAFRA 카드에서 「코드사전 동기화」가 단위 단계까지 성공하는지 확인하세요. 인증키는 DB 저장값이 .env보다 우선합니다."
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
        message: apiMsg ? `${apiMsg}.${authHint}` : `단위코드 API 오류.${authHint}`,
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

  return buildSuccess<MafraUnitCode[]>({
    source: SOURCE,
    requestId,
    startedAt,
    data: unique,
    message: `단위코드 동기화 성공 (${unique.length}건)`,
  });
}

export async function syncMafraUnitCodes(params: {
  requestId: string;
  appId?: string;
  updatedByEmail?: string | null;
}): Promise<ApiResponse<MafraUnitCodeSyncResponseData>> {
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

  const fetched = await fetchUnitCodesFromMafra(apiKey, params.requestId);
  if (!fetched.ok) {
    await saveApiLog({
      ok: false,
      meta: fetched.meta,
      appId: params.appId,
      message: shortMessageForApiLog(fetched.message),
    });
    return fetched as ApiResponse<MafraUnitCodeSyncResponseData>;
  }

  await saveMafraUnitCodeCache(fetched.data, params.updatedByEmail);
  const updatedAt = new Date().toISOString();
  const response = buildSuccess<MafraUnitCodeSyncResponseData>({
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

export async function searchMafraUnitCodes(params: {
  requestId: string;
  query: string;
  appId?: string;
  forceSync?: boolean;
}): Promise<ApiResponse<MafraUnitCodeSearchResponseData>> {
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

  let cache = await loadMafraUnitCodeCache();
  const cacheAge = cache.updatedAt ? Date.now() - new Date(cache.updatedAt).getTime() : Number.POSITIVE_INFINITY;
  if (params.forceSync || !cache.items.length || cacheAge > CACHE_TTL_MS) {
    const synced = await syncMafraUnitCodes({
      requestId: `${params.requestId}-sync`,
      appId: "admin-mafra-unit-codes-sync",
    });
    if (!synced.ok) {
      return synced as ApiResponse<MafraUnitCodeSearchResponseData>;
    }
    cache = await loadMafraUnitCodeCache();
  }

  /** CODENAME이 한글 위주일 때 영문 단위(kg 등)로는 안 잡히는 경우가 많아 동의어·변형을 함께 검색 */
  const needles = buildUnitSearchNeedles(query);
  const matches = cache.items
    .filter((row) => rowMatchesUnitNeedles(row, needles))
    .slice(0, 50);

  const response = buildSuccess<MafraUnitCodeSearchResponseData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    message: `단위코드 검색 완료 (${matches.length}건)`,
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
 * 캐시에 단위 전체를 올려 두고, 데스크에서 드롭다운으로 고르게 할 때 사용합니다.
 * 캐시가 비었거나 TTL이 지나면 동기화를 시도합니다.
 */
export async function listMafraUnitCodes(params: {
  requestId: string;
  appId?: string;
  forceSync?: boolean;
}): Promise<ApiResponse<MafraUnitCodeListResponseData>> {
  const startedAt = performance.now();

  let cache = await loadMafraUnitCodeCache();
  const cacheAge = cache.updatedAt ? Date.now() - new Date(cache.updatedAt).getTime() : Number.POSITIVE_INFINITY;
  const needsRefresh = params.forceSync || !cache.items.length || cacheAge > CACHE_TTL_MS;

  if (needsRefresh) {
    const synced = await syncMafraUnitCodes({
      requestId: `${params.requestId}-sync`,
      appId: params.appId ?? "desk-mafra-unit-codes-list",
    });
    if (!synced.ok) {
      /** 동기화만 실패했고 예전 캐시가 있으면 목록은 그대로 쓴다(데스크 드롭다운 유지). */
      if (cache.items.length > 0) {
        const staleItems = [...cache.items].sort((a, b) => {
          const na = a.CODENAME.localeCompare(b.CODENAME, "ko");
          if (na !== 0) return na;
          return a.CODEID.localeCompare(b.CODEID, "ko", { numeric: true });
        });
        const staleResponse = buildSuccess<MafraUnitCodeListResponseData>({
          source: SOURCE,
          requestId: params.requestId,
          startedAt,
          message: `최신 동기화에 실패했습니다. 이전에 저장된 단위 ${staleItems.length}건을 표시합니다. (${synced.message})`,
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
      return synced as ApiResponse<MafraUnitCodeListResponseData>;
    }
    cache = await loadMafraUnitCodeCache();
  }

  const items = [...cache.items].sort((a, b) => {
    const na = a.CODENAME.localeCompare(b.CODENAME, "ko");
    if (na !== 0) return na;
    return a.CODEID.localeCompare(b.CODEID, "ko", { numeric: true });
  });

  const response = buildSuccess<MafraUnitCodeListResponseData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    message: `단위코드 ${items.length}건`,
    data: {
      updatedAt: cache.updatedAt,
      total: items.length,
      items,
    },
  });
  await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
  return response;
}
