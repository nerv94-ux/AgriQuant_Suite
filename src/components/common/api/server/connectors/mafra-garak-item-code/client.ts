import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import { getMafraApiKey } from "../../admin/mafraItemCodeStore";
import type {
  MafraGarakItemCode,
  MafraGarakItemCodeSearchResponseData,
  SearchMafraGarakItemCodeRequest,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
const API_URL = "Grid_20220823000000000628_1";

function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function getTagValue(xml: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = pattern.exec(xml);
  if (!match) return "";
  return decodeXml(match[1].trim());
}

function parseRows(xml: string): MafraGarakItemCode[] {
  const matches = xml.matchAll(/<row>([\s\S]*?)<\/row>/gi);
  const rows: MafraGarakItemCode[] = [];
  for (const match of matches) {
    const rowXml = match[1];
    rows.push({
      STAN_CODE: getTagValue(rowXml, "STAN_CODE"),
      SCLASSCODE: getTagValue(rowXml, "SCLASSCODE"),
      GARRAK_CODE: getTagValue(rowXml, "GARRAK_CODE"),
      GARRAK_NAME: getTagValue(rowXml, "GARRAK_NAME"),
    });
  }
  return rows;
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

export async function searchMafraGarakItemCodes(params: {
  requestId: string;
  appId?: string;
  request: SearchMafraGarakItemCodeRequest;
}): Promise<ApiResponse<MafraGarakItemCodeSearchResponseData>> {
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

  const garrakName = params.request.garrakName?.trim() ?? "";
  const stanCode = params.request.stanCode?.trim() ?? "";
  const sclassCode = params.request.sclassCode?.trim() ?? "";
  const garrakCode = params.request.garrakCode?.trim() ?? "";
  if (!garrakName && !stanCode && !sclassCode && !garrakCode) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "garrakName, stanCode, sclassCode, garrakCode 중 최소 1개를 입력해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const startIndex = toPositiveInt(params.request.startIndex, 1);
  const endIndex = Math.max(startIndex, toPositiveInt(params.request.endIndex, 50));
  const search = new URLSearchParams();
  if (garrakName) search.set("GARRAK_NAME", garrakName);
  if (stanCode) search.set("STAN_CODE", stanCode);
  if (sclassCode) search.set("SCLASSCODE", sclassCode);
  if (garrakCode) search.set("GARRAK_CODE", garrakCode);
  const url = `${BASE_HOST}/${encodeURIComponent(apiKey)}/xml/${API_URL}/${startIndex}/${endIndex}?${search.toString()}`;

  try {
    const res = await fetch(url, { method: "GET" });
    const xml = await res.text();
    if (!res.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: res.status,
        message: `가락시장품목코드조회 API 호출 실패 (HTTP ${res.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }
    if (!xml.trim().startsWith("<")) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: ApiErrorCategory.UNKNOWN,
        message: "가락시장품목코드조회 API 응답이 XML 형식이 아닙니다.",
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    const code = getTagValue(xml, "code");
    const message = getTagValue(xml, "message");
    if (code !== "INFO-000" && code !== "INFO-200") {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: mapErrorCategory(code),
        message: `${code} ${message}`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    const totalCount = Number(getTagValue(xml, "totalCnt")) || 0;
    const rows = parseRows(xml);
    const response = buildSuccess<MafraGarakItemCodeSearchResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message: `가락시장품목코드 조회 완료 (${rows.length}건)`,
      data: { totalCount, rows },
    });
    await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } catch (error) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.NETWORK_ERROR,
      message: error instanceof Error ? error.message : "가락시장품목코드조회 API 호출 중 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
}
