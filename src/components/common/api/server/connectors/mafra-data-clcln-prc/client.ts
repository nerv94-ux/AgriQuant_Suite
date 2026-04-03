import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { getMafraApiKey } from "../../admin/mafraItemCodeStore";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import { resolveMafraCodebook } from "../mafra-codebook";
import type {
  MafraDataClclnPrcItem,
  MafraDataClclnPrcRequest,
  MafraDataClclnPrcResponseData,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
const API_URL = "Grid_20240625000000000655_1";

function parsePayload(rawText: string): {
  code: string;
  message: string;
  totalCount: number;
  rows: MafraDataClclnPrcItem[];
} {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  const rootKey = Object.keys(parsed)[0];
  const root = (rootKey ? parsed[rootKey] : parsed) as Record<string, unknown>;
  const result = (root.result ?? {}) as Record<string, unknown>;
  const rowsRaw = Array.isArray(root.row) ? root.row : [];
  const rows = rowsRaw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      SALEDATE: String(row.SALEDATE ?? ""),
      WHSALCD: String(row.WHSALCD ?? ""),
      CMPCD: String(row.CMPCD ?? ""),
      SEQ: String(row.SEQ ?? ""),
      NO1: String(row.NO1 ?? ""),
      NO2: String(row.NO2 ?? ""),
      MEJANG: String(row.MEJANG ?? ""),
      MMCD: String(row.MMCD ?? ""),
      LARGE: String(row.LARGE ?? ""),
      MID: String(row.MID ?? ""),
      SMALL: String(row.SMALL ?? ""),
      CMPGOOD: String(row.CMPGOOD ?? ""),
      PUMNAME: String(row.PUMNAME ?? ""),
      GOODNAME: String(row.GOODNAME ?? ""),
      DANQ: String(row.DANQ ?? ""),
      DANCD: String(row.DANCD ?? ""),
      POJCD: String(row.POJCD ?? ""),
      SIZECD: String(row.SIZECD ?? ""),
      LVCD: String(row.LVCD ?? ""),
      QTY: String(row.QTY ?? ""),
      COST: String(row.COST ?? ""),
      AMERCD: String(row.AMERCD ?? ""),
      SANCD: String(row.SANCD ?? ""),
      CMPSAN: String(row.CMPSAN ?? ""),
      SANNAME: String(row.SANNAME ?? ""),
      CHCD: String(row.CHCD ?? ""),
      SMANCD: String(row.SMANCD ?? ""),
      CHULNO: String(row.CHULNO ?? ""),
      CHULCD: String(row.CHULCD ?? ""),
      CHULNAME: String(row.CHULNAME ?? ""),
      FARMNAME: String(row.FARMNAME ?? ""),
      TOTQTY: String(row.TOTQTY ?? ""),
      TOTAMT: String(row.TOTAMT ?? ""),
      SBIDTIME: String(row.SBIDTIME ?? ""),
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

export async function fetchMafraDataClclnPrc(params: {
  requestId: string;
  appId?: string;
  request: MafraDataClclnPrcRequest;
}): Promise<ApiResponse<MafraDataClclnPrcResponseData>> {
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

  const saleDate = params.request.saleDate?.trim() ?? "";
  if (!/^\d{8}$/.test(saleDate)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "saleDate는 YYYYMMDD 형식이어야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  let whsalcd = params.request.whsalcd?.trim() ?? "";
  let cmpcd = params.request.cmpcd?.trim() ?? "";

  if (params.request.autoResolveCodes !== false && (!whsalcd || !cmpcd)) {
    const resolved = await resolveMafraCodebook({
      requestId: `${params.requestId}-resolve`,
      appId: params.appId,
      request: {
        marketName: params.request.whsalName,
        corpName: params.request.cmpName,
      },
    });
    whsalcd ||= resolved.market.code ?? "";
    cmpcd ||= resolved.corp.code ?? "";
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

  const search = new URLSearchParams({ SALEDATE: saleDate });
  if (whsalcd) search.set("WHSALCD", whsalcd);
  if (cmpcd) search.set("CMPCD", cmpcd);

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
        message: `원천데이터 정산가격 API 호출 실패 (HTTP ${res.status})`,
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
        message: "원천데이터 정산가격 API가 XML로 응답했습니다. 현재는 JSON 호출만 허용합니다.",
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

    const response = buildSuccess<MafraDataClclnPrcResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message: `원천데이터 정산가격 조회 성공 (${payload.rows.length}건)`,
      data: {
        totalCount: payload.totalCount,
        startIndex,
        endIndex,
        rows: payload.rows,
        resolved: {
          whsalcd: whsalcd || null,
          cmpcd: cmpcd || null,
        },
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
      message: error instanceof Error ? error.message : "원천데이터 정산가격 API 호출 중 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
}
