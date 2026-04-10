import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { getMafraApiKey } from "../../admin/mafraItemCodeStore";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import type {
  MafraRetailSalPriceItem,
  MafraRetailSalPriceRequest,
  MafraRetailSalPriceResponseData,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
/** 농수축산물 소매가격 (엑셀 명세 서비스 ID) */
const API_URL = "Grid_20141225000000000163_1";

/** 단일 row 객체로 오는 경우(1건) 대비 — 품목코드 그리드와 동일 패턴 */
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

function parsePayload(rawText: string): {
  code: string;
  message: string;
  totalCount: number;
  rows: MafraRetailSalPriceItem[];
} {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  const rootKey = Object.keys(parsed)[0];
  const root = (rootKey ? parsed[rootKey] : parsed) as Record<string, unknown>;
  const result = (root.result ?? {}) as Record<string, unknown>;
  const rowsRaw = normalizeRows(root.row);
  const rows = rowsRaw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      ROW_NUM: String(row.ROW_NUM ?? ""),
      EXAMIN_DE: String(row.EXAMIN_DE ?? ""),
      FRMPRD_CATGORY_NM: String(row.FRMPRD_CATGORY_NM ?? ""),
      FRMPRD_CATGORY_CD: String(row.FRMPRD_CATGORY_CD ?? ""),
      PRDLST_CD: String(row.PRDLST_CD ?? ""),
      PRDLST_NM: String(row.PRDLST_NM ?? ""),
      SPCIES_CD: String(row.SPCIES_CD ?? ""),
      SPCIES_NM: String(row.SPCIES_NM ?? ""),
      GRAD_CD: String(row.GRAD_CD ?? ""),
      GRAD_NM: String(row.GRAD_NM ?? ""),
      EXAMIN_UNIT: String(row.EXAMIN_UNIT ?? ""),
      AREA_CD: String(row.AREA_CD ?? ""),
      AREA_NM: String(row.AREA_NM ?? ""),
      MRKT_CD: String(row.MRKT_CD ?? ""),
      MRKT_NM: String(row.MRKT_NM ?? ""),
      AMT: String(row.AMT ?? ""),
    }));
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
 * 농수축산물 소매가격 — 품목·산지 등과 동일 MAFRA API_KEY, 동일 호스트.
 */
export async function fetchMafraRetailSalPrice(params: {
  requestId: string;
  appId?: string;
  request: MafraRetailSalPriceRequest;
}): Promise<ApiResponse<MafraRetailSalPriceResponseData>> {
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

  const examinDe = params.request.examinDe?.trim() ?? "";
  if (!/^\d{8}$/.test(examinDe)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "examinDe(조사일자)는 YYYYMMDD 형식이어야 합니다.",
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

  const search = new URLSearchParams({ EXAMIN_DE: examinDe });
  setOptional(search, "FRMPRD_CATGORY_CD", params.request.FRMPRD_CATGORY_CD);
  setOptional(search, "PRDLST_CD", params.request.PRDLST_CD);
  setOptional(search, "SPCIES_CD", params.request.SPCIES_CD);
  setOptional(search, "GRAD_CD", params.request.GRAD_CD);
  setOptional(search, "AREA_CD", params.request.AREA_CD);
  setOptional(search, "MRKT_CD", params.request.MRKT_CD);

  try {
    const qs = search.toString();
    const requestUrl = `${BASE_HOST}/${encodeURIComponent(apiKey)}/json/${API_URL}/${startIndex}/${endIndex}?${qs}`;
    const res = await fetch(requestUrl, { method: "GET" });
    const text = await res.text();

    if (!res.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: res.status,
        message: `소매가격 API 호출 실패 (HTTP ${res.status})`,
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
        message: "소매가격 API가 XML로 응답했습니다. 현재는 JSON 호출만 지원합니다.",
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
      message = `소매가격 조회 성공 (${payload.rows.length}건, total ${payload.totalCount})`;
    } else {
      const apiMsg = payload.message?.trim() ?? "";
      if (payload.code === "INFO-000") {
        message = [
          `소매가격 ${payload.code}${apiMsg ? `: ${apiMsg}` : ""} — 이번 조건으로는 0건입니다.`,
          "EXAMIN_DE(조사일)를 바꾸거나 품목·지역 등 선택 필터를 넣어 보세요. 명세 예시 일자: 20150401.",
          "INFO-000은 호출·인증이 정상이라는 뜻이며, 0건은 해당 일자·조건에 데이터가 없을 때 흔합니다.",
        ].join(" ");
      } else if (payload.code === "INFO-200") {
        message = `소매가격 ${payload.code}: ${apiMsg || "조회된 데이터가 없습니다."} 조사일·필터를 바꿔 보세요.`;
      } else {
        message = `소매가격 ${payload.code || "응답"}: ${apiMsg || "0건"}. EXAMIN_DE·필터를 확인하세요.`;
      }
    }

    const response = buildSuccess<MafraRetailSalPriceResponseData>({
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
      message: error instanceof Error ? error.message : "소매가격 API 호출 중 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
}
