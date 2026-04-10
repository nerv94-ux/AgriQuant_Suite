import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { getMafraApiKey } from "../../admin/mafraItemCodeStore";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import type {
  MafraAgricnsmTrndItem,
  MafraAgricnsmTrndRequest,
  MafraAgricnsmTrndResponseData,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
/** 소매가격정보·소비 트렌드 결합정보 (W_DI_AGRICNSMTRND) */
const API_URL = "Grid_20260128000000000689_1";

function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }
  if (typeof value === "object") {
    return [value as Record<string, unknown>];
  }
  return [];
}

function rowToItem(row: Record<string, unknown>): MafraAgricnsmTrndItem {
  const s = (k: string) => String(row[k] ?? "");
  const base: MafraAgricnsmTrndItem = {
    ROW_NUM: s("ROW_NUM"),
    CRTR_YEAR: s("CRTR_YEAR"),
    CRTR_MONTH: s("CRTR_MONTH"),
    CLSF_NM: s("CLSF_NM"),
    ITEM_NM: s("ITEM_NM"),
    MON_PRCHS_AMT: s("MON_PRCHS_AMT"),
    MON_PRCHS_NOCS: s("MON_PRCHS_NOCS"),
    MON_PRCHS_NOCS_AMT: s("MON_PRCHS_NOCS_AMT"),
    ESTMTN_NTSL_QTY: s("ESTMTN_NTSL_QTY"),
    AVG_AMT: s("AVG_AMT"),
    ESTMTN_SLS_AMT: s("ESTMTN_SLS_AMT"),
    MON_AVG_AMT: s("MON_AVG_AMT"),
    MON_AMPL_CFFCNT: s("MON_AMPL_CFFCNT"),
    MON_FLCTN_CFFCNT: s("MON_FLCTN_CFFCNT"),
    MON_MAX_AMT: s("MON_MAX_AMT"),
    MON_MIN_AMT: s("MON_MIN_AMT"),
    MON_SDVTN: s("MON_SDVTN"),
    YEAR_AVG_AMT: s("YEAR_AVG_AMT"),
    YEAR_AMPL_CFFCNT: s("YEAR_AMPL_CFFCNT"),
    YEAR_FLCTN_CFFCNT: s("YEAR_FLCTN_CFFCNT"),
    YEAR_MAX_AMT: s("YEAR_MAX_AMT"),
    YEAR_MIN_AMT: s("YEAR_MIN_AMT"),
    YEAR_SDVTN: s("YEAR_SDVTN"),
    REG_DT: s("REG_DT"),
    REG_USERID: s("REG_USERID"),
    UPD_DT: s("UPD_DT"),
    UPD_USERID: s("UPD_USERID"),
  };
  // 명세에 없는 확장 필드도 그대로 보존해서 UI에서 전체 컬럼을 확인 가능하게 한다.
  for (const [k, v] of Object.entries(row)) {
    const key = String(k ?? "").trim();
    if (!key) continue;
    base[key] = String(v ?? "");
  }
  return base;
}

function parsePayload(rawText: string): {
  code: string;
  message: string;
  totalCount: number;
  rows: MafraAgricnsmTrndItem[];
} {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  const rootKey = Object.keys(parsed)[0];
  const root = (rootKey ? parsed[rootKey] : parsed) as Record<string, unknown>;
  const result = (root.result ?? {}) as Record<string, unknown>;
  const rowsRaw = normalizeRows(root.row);
  const rows = rowsRaw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => rowToItem(row));
  const totalRaw = root.totalCnt ?? root.TotalCnt ?? (result as { totalCnt?: unknown }).totalCnt;
  const totalCount = Number(totalRaw ?? 0);
  return {
    code: String(result.code ?? root.code ?? ""),
    message: String(result.message ?? root.message ?? ""),
    totalCount: Number.isFinite(totalCount) ? totalCount : rows.length,
    rows,
  };
}

function toPositiveInt(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
}

function mapErrorCategory(code: string) {
  if (code === "INFO-100") return ApiErrorCategory.AUTH_ERROR;
  if (code === "ERROR-350") return ApiErrorCategory.RATE_LIMIT;
  if (code.startsWith("ERROR-")) return ApiErrorCategory.VALIDATION_ERROR;
  return ApiErrorCategory.UNKNOWN;
}

function setOptional(search: URLSearchParams, key: string, value: string | undefined) {
  const v = value?.trim() ?? "";
  if (v) search.set(key, v);
}

/**
 * 소매가격정보·소비 트렌드 결합 — 동일 MAFRA API_KEY·호스트.
 */
export async function fetchMafraAgricnsmTrnd(params: {
  requestId: string;
  appId?: string;
  request: MafraAgricnsmTrndRequest;
}): Promise<ApiResponse<MafraAgricnsmTrndResponseData>> {
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

  const startIndex = toPositiveInt(params.request.startIndex, 1);
  const endIndex = Math.max(startIndex, toPositiveInt(params.request.endIndex, 100));
  if (endIndex - startIndex > 1000) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "한 번의 조회 범위는 최대 1000건입니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const search = new URLSearchParams();
  setOptional(search, "CRTR_YEAR", params.request.CRTR_YEAR);
  setOptional(search, "CRTR_MONTH", params.request.CRTR_MONTH);

  try {
    const qs = search.toString();
    const pathBase = `${BASE_HOST}/${encodeURIComponent(apiKey)}/json/${API_URL}/${startIndex}/${endIndex}`;
    const requestUrl = qs ? `${pathBase}?${qs}` : pathBase;
    const res = await fetch(requestUrl, { method: "GET" });
    const text = await res.text();

    if (!res.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: res.status,
        message: `소비 트렌드 결합 API 호출 실패 (HTTP ${res.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    if (text.trim().startsWith("<")) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: ApiErrorCategory.UNKNOWN,
        message: "소비 트렌드 결합 API가 XML로 응답했습니다. 현재는 JSON 호출만 지원합니다.",
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    const payload = parsePayload(text);
    const okCode = payload.code === "INFO-000" || payload.code === "INFO-200";
    if (!okCode && payload.code) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: mapErrorCategory(payload.code),
        message: `${payload.code} ${payload.message}`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    let message: string;
    if (payload.rows.length > 0) {
      message = `소비 트렌드 결합 조회 성공 (${payload.rows.length}건, total ${payload.totalCount})`;
    } else {
      const apiMsg = payload.message?.trim() ?? "";
      if (payload.code === "INFO-000") {
        message = [
          `소비 트렌드 결합 ${payload.code}${apiMsg ? `: ${apiMsg}` : ""} — 이번 조건으로는 0건입니다.`,
          "CRTR_YEAR·CRTR_MONTH 쿼리를 넣거나 페이지 범위를 조정해 보세요.",
          "INFO-000은 호출·인증이 정상일 때 나올 수 있습니다.",
        ].join(" ");
      } else if (payload.code === "INFO-200") {
        message = `소비 트렌드 결합 ${payload.code}: ${apiMsg || "조회된 데이터가 없습니다."}`;
      } else {
        message = `소비 트렌드 결합 ${payload.code || "응답"}: ${apiMsg || "0건"}.`;
      }
    }

    const response = buildSuccess<MafraAgricnsmTrndResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message,
      data: {
        totalCount: payload.totalCount,
        startIndex,
        endIndex,
        rows: payload.rows,
      },
    });
    await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } catch (error) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.NETWORK_ERROR,
      message: error instanceof Error ? error.message : "소비 트렌드 결합 API 호출 중 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
}
