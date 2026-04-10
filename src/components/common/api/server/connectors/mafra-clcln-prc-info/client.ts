import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { getMafraApiKey } from "../../admin/mafraItemCodeStore";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import { resolveMafraCodebook } from "../mafra-codebook";
import type {
  MafraClclnPrcInfoItem,
  MafraClclnPrcInfoRequest,
  MafraClclnPrcInfoResponseData,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
const API_URL = "Grid_20240625000000000653_1";

/** OpenAPI가 건수 1일 때 `row`를 배열이 아닌 단일 객체로 주는 경우 */
function normalizeRowList(value: unknown): Record<string, unknown>[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

function parsePayload(rawText: string): {
  code: string;
  message: string;
  totalCount: number;
  rows: MafraClclnPrcInfoItem[];
} {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  const rootKey = Object.keys(parsed)[0];
  const root = (rootKey ? parsed[rootKey] : parsed) as Record<string, unknown>;
  const result = (root.result ?? {}) as Record<string, unknown>;
  const rowsRaw = normalizeRowList(root.row);
  const rows = rowsRaw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      SALEDATE: String(row.SALEDATE ?? ""),
      WHSALCD: String(row.WHSALCD ?? ""),
      WHSALNAME: String(row.WHSALNAME ?? ""),
      CMPCD: String(row.CMPCD ?? ""),
      CMPNAME: String(row.CMPNAME ?? ""),
      LARGE: String(row.LARGE ?? ""),
      LARGENAME: String(row.LARGENAME ?? ""),
      MID: String(row.MID ?? ""),
      MIDNAME: String(row.MIDNAME ?? ""),
      SMALL: String(row.SMALL ?? ""),
      SMALLNAME: String(row.SMALLNAME ?? ""),
      DANQ: String(row.DANQ ?? ""),
      DANCD: String(row.DANCD ?? ""),
      POJCD: String(row.POJCD ?? ""),
      STD: String(row.STD ?? ""),
      SIZECD: String(row.SIZECD ?? ""),
      SIZENAME: String(row.SIZENAME ?? ""),
      LVCD: String(row.LVCD ?? ""),
      LVNAME: String(row.LVNAME ?? ""),
      SANCD: String(row.SANCD ?? ""),
      SANNAME: String(row.SANNAME ?? ""),
      TOTQTY: String(row.TOTQTY ?? ""),
      TOTAMT: String(row.TOTAMT ?? ""),
      MINAMT: String(row.MINAMT ?? ""),
      MAXAMT: String(row.MAXAMT ?? ""),
      AVGAMT: String(row.AVGAMT ?? ""),
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

export async function fetchMafraClclnPrcInfo(params: {
  requestId: string;
  appId?: string;
  request: MafraClclnPrcInfoRequest;
}): Promise<ApiResponse<MafraClclnPrcInfoResponseData>> {
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
  let small = params.request.small?.trim() ?? "";

  if (params.request.autoResolveCodes !== false && (!whsalcd || !cmpcd || !small)) {
    const resolved = await resolveMafraCodebook({
      requestId: `${params.requestId}-resolve`,
      appId: params.appId,
      request: {
        marketName: params.request.whsalName,
        corpName: params.request.cmpName,
        itemName: params.request.itemName,
        preferGarakItemCode: params.request.preferGarakItemCode,
      },
    });
    whsalcd ||= resolved.market.code ?? "";
    cmpcd ||= resolved.corp.code ?? "";
    small ||= resolved.item.code ?? "";
  }

  if (!whsalcd) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "whsalcd가 필요합니다. 직접 입력하거나 whsalName으로 자동해석해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
  if (params.request.itemName?.trim() && !small) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "itemName을 SMALL 코드로 해석하지 못했습니다. itemName을 바꾸거나 small 코드를 직접 입력해 주세요.",
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

  const search = new URLSearchParams({
    SALEDATE: saleDate,
    WHSALCD: whsalcd,
  });
  if (cmpcd) search.set("CMPCD", cmpcd);
  if (params.request.large?.trim()) search.set("LARGE", params.request.large.trim());
  if (params.request.mid?.trim()) search.set("MID", params.request.mid.trim());
  if (small) search.set("SMALL", small);

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
        message: `정산 가격 정보 API 호출 실패 (HTTP ${res.status})`,
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
        message: "정산 가격 정보 API가 XML로 응답했습니다. 현재는 JSON 호출만 허용합니다.",
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

    const response = buildSuccess<MafraClclnPrcInfoResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message: `정산 가격 정보 조회 성공 (${payload.rows.length}건)`,
      data: {
        totalCount: payload.totalCount,
        startIndex,
        endIndex,
        rows: payload.rows,
        resolved: {
          whsalcd: whsalcd || null,
          cmpcd: cmpcd || null,
          small: small || null,
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
      message: error instanceof Error ? error.message : "정산 가격 정보 API 호출 중 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
}
