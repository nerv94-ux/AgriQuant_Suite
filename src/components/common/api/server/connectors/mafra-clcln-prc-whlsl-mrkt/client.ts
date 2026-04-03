import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { getMafraApiKey } from "../../admin/mafraItemCodeStore";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import { resolveMafraCodebook } from "../mafra-codebook";
import type {
  MafraClclnPrcWhlslMrktItem,
  MafraClclnPrcWhlslMrktRequest,
  MafraClclnPrcWhlslMrktResponseData,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
const API_URL = "Grid_20240625000000000656_1";

function parsePayload(rawText: string): {
  code: string;
  message: string;
  totalCount: number;
  rows: MafraClclnPrcWhlslMrktItem[];
} {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  const rootKey = Object.keys(parsed)[0];
  const root = (rootKey ? parsed[rootKey] : parsed) as Record<string, unknown>;
  const result = (root.result ?? {}) as Record<string, unknown>;
  const rowsRaw = Array.isArray(root.row) ? root.row : [];
  const rows = rowsRaw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      WHSALCD: String(row.WHSALCD ?? ""),
      WHSALNAME: String(row.WHSALNAME ?? ""),
      TOTQTY: String(row.TOTQTY ?? ""),
      TOTAMT: String(row.TOTAMT ?? ""),
      REGIST_DT: String(row.REGIST_DT ?? ""),
    }));
  const totalCount = Number(root.totalCnt ?? 0);
  return {
    code: String(result.code ?? ""),
    message: String(result.message ?? ""),
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

export async function fetchMafraClclnPrcWhlslMrkt(params: {
  requestId: string;
  appId?: string;
  request: MafraClclnPrcWhlslMrktRequest;
}): Promise<ApiResponse<MafraClclnPrcWhlslMrktResponseData>> {
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

  const registDt = params.request.registDt?.trim() ?? "";
  if (!/^\d{8}$/.test(registDt)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "registDt는 YYYYMMDD 형식이어야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  let whsalcd = params.request.whsalcd?.trim() ?? "";
  if (params.request.autoResolveCodes !== false && !whsalcd && params.request.whsalName?.trim()) {
    const resolved = await resolveMafraCodebook({
      requestId: `${params.requestId}-resolve`,
      appId: params.appId,
      request: { marketName: params.request.whsalName },
    });
    whsalcd = resolved.market.code ?? "";
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

  const search = new URLSearchParams({ REGIST_DT: registDt });
  if (whsalcd) search.set("WHSALCD", whsalcd);
  const url = `${BASE_HOST}/${encodeURIComponent(apiKey)}/json/${API_URL}/${startIndex}/${endIndex}?${search.toString()}`;

  try {
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    if (!res.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: res.status,
        message: `기간별 도매시장 총물량/총금액 API 호출 실패 (HTTP ${res.status})`,
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
        message: "기간별 도매시장 총물량/총금액 API가 XML로 응답했습니다. 현재는 JSON 호출만 허용합니다.",
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    const payload = parsePayload(text);
    if (payload.code !== "INFO-000" && payload.code !== "INFO-200") {
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

    const response = buildSuccess<MafraClclnPrcWhlslMrktResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message: `기간별 도매시장 총물량/총금액 조회 성공 (${payload.rows.length}건)`,
      data: {
        totalCount: payload.totalCount,
        startIndex,
        endIndex,
        rows: payload.rows,
        resolved: { whsalcd: whsalcd || null },
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
      message:
        error instanceof Error ? error.message : "기간별 도매시장 총물량/총금액 API 호출 중 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
}
