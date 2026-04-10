import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { getMafraApiKey } from "../../admin/mafraItemCodeStore";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import type {
  MafraPesticideResidueItem,
  MafraPesticideResidueRequest,
  MafraPesticideResidueResponseData,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
const API_URL = "Grid_20161206000000000390_1";

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

function rowToItem(row: Record<string, unknown>): MafraPesticideResidueItem {
  const s = (k: string) => String(row[k] ?? "");
  return {
    ROW_NUM: s("ROW_NUM"),
    SPLORE_NO: s("SPLORE_NO"),
    PRDLST_CODE: s("PRDLST_CODE"),
    PRDLST_NM: s("PRDLST_NM"),
    TKAWY_STEP: s("TKAWY_STEP"),
    CTVT_RAISNG: s("CTVT_RAISNG"),
    MKER: s("MKER"),
    MKER_ADRES: s("MKER_ADRES"),
    CTVT_AR: s("CTVT_AR"),
    EXAMIN_VOLM: s("EXAMIN_VOLM"),
    EXAMIN_HRMFLNS_MTTR_CODE: s("EXAMIN_HRMFLNS_MTTR_CODE"),
    EXAMIN_HRMFLNS_MTTR_NM: s("EXAMIN_HRMFLNS_MTTR_NM"),
    REGIST_DE: s("REGIST_DE"),
    EXAMIN_ENGN: s("EXAMIN_ENGN"),
    ANALS_RESULT: s("ANALS_RESULT"),
  };
}

function parsePayload(rawText: string): {
  code: string;
  message: string;
  totalCount: number;
  rows: MafraPesticideResidueItem[];
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

/** 농산물 잔류농약 분석결과 — 소매가격 등과 동일 MAFRA API_KEY */
export async function fetchMafraPesticideResidue(params: {
  requestId: string;
  appId?: string;
  request: MafraPesticideResidueRequest;
}): Promise<ApiResponse<MafraPesticideResidueResponseData>> {
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
  setOptional(search, "SPLORE_NO", params.request.SPLORE_NO);
  setOptional(search, "REGIST_DE", params.request.REGIST_DE);

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
        message: `잔류농약 분석 API 호출 실패 (HTTP ${res.status})`,
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
        message: "잔류농약 분석 API가 XML로 응답했습니다. 현재는 JSON 호출만 지원합니다.",
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

    const message =
      payload.rows.length > 0
        ? `잔류농약 분석 조회 성공 (${payload.rows.length}건, total ${payload.totalCount})`
        : [
            `잔류농약 분석 ${payload.code || "INFO-?"}: ${payload.message?.trim() || "0건"}`,
            "표본번호·등록일 필터를 조정하거나 페이지 범위를 바꿔 보세요.",
          ].join(" ");

    const response = buildSuccess<MafraPesticideResidueResponseData>({
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
      message: error instanceof Error ? error.message : "잔류농약 분석 API 호출 중 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
}
