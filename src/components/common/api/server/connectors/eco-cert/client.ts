import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { getEcoCertRuntimeConfig } from "../../admin/providerSettings";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import type {
  EcoCertApiRawResponse,
  EcoCertHealthResponseData,
  EcoCertItem,
  EcoCertListRequest,
  EcoCertListResponseData,
} from "./types";

const SOURCE = "ECO_CERT" as const;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_API_URL = "https://apis.data.go.kr/1543145/ECFRDCERTINFO/getCertDataList";

function parsePositiveInt(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }
  return fallback;
}

function normalizeRows(value: unknown): EcoCertItem[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is EcoCertItem => Boolean(item) && typeof item === "object");
  }
  if (value && typeof value === "object") {
    return [value as EcoCertItem];
  }
  return [];
}

function parseYmdOrBlank(value: string | undefined) {
  const text = value?.trim() ?? "";
  if (!text) return "";
  return /^\d{8}$/.test(text) ? text : "";
}

function addQuery(search: URLSearchParams, key: string, value: string | undefined) {
  const text = value?.trim() ?? "";
  if (text) {
    search.set(key, text);
  }
}

function buildServiceKeyCandidates(value: string) {
  const raw = value.trim();
  const list: string[] = [];
  if (raw) {
    list.push(raw);
  }
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded && !list.includes(decoded)) {
      list.push(decoded);
    }
  } catch {
    // ignore decode errors
  }
  return list;
}

export async function callEcoCertList(
  params: {
    requestId: string;
    request: EcoCertListRequest;
    timeoutMs?: number;
    appId?: string;
  }
): Promise<ApiResponse<EcoCertListResponseData>> {
  const startedAt = performance.now();
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runtime = await getEcoCertRuntimeConfig();

  if (!runtime.enabled) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.DISABLED,
      message: "친환경 인증정보 커넥터가 관리자 설정에서 비활성화되어 있습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  if (!runtime.serviceKey) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: "ECO_CERT_SERVICE_KEY가 설정되지 않았습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const apiUrl = (runtime.apiUrl || DEFAULT_API_URL).trim();
  const pageNo = Math.max(1, Math.round(params.request.pageNo ?? runtime.pageNo));
  const numOfRows = Math.min(100, Math.max(1, Math.round(params.request.numOfRows ?? runtime.numOfRows)));
  const type = params.request.type ?? runtime.type;

  const certVldEndYmdS = parseYmdOrBlank(params.request.certVldEndYmdS);
  const certVldEndYmdE = parseYmdOrBlank(params.request.certVldEndYmdE);
  if ((params.request.certVldEndYmdS && !certVldEndYmdS) || (params.request.certVldEndYmdE && !certVldEndYmdE)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "CERT_VLD_END_YMD_S/E는 YYYYMMDD 형식이어야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const serviceKeys = buildServiceKeyCandidates(runtime.serviceKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let lastFailure = "응답 없음";
    let lastHttpStatus: number | undefined;

    for (const serviceKey of serviceKeys) {
      const search = new URLSearchParams({
        serviceKey,
        pageNo: String(pageNo),
        numOfRows: String(numOfRows),
        type,
      });
      addQuery(search, "CHC_COL", params.request.chcCol);
      addQuery(search, "CERT_NO", params.request.certNo);
      addQuery(search, "CERT_SE_CD", params.request.certSeCd);
      addQuery(search, "CERT_VLD_END_YMD_S", certVldEndYmdS);
      addQuery(search, "CERT_VLD_END_YMD_E", certVldEndYmdE);
      addQuery(search, "PRDCR_GRP_NM", params.request.prdcrGrpNm);
      addQuery(search, "RPRSV_NM", params.request.rprsvNm);
      addQuery(search, "PLOR_NM", params.request.plorNm);
      addQuery(search, "CERT_ITEM_NM", params.request.certItemNm);

      const url = `${apiUrl}?${search.toString()}`;
      const res = await fetch(url, { method: "GET", signal: controller.signal });
      const text = await res.text();

      if (!res.ok) {
        lastHttpStatus = res.status;
        lastFailure = text.trim().slice(0, 200) || `HTTP ${res.status}`;
        continue;
      }

      if (text.trim().startsWith("<")) {
        lastFailure = "현재 운영 커넥터는 JSON 응답(type=JSON)만 지원합니다.";
        continue;
      }

      const parsed = JSON.parse(text) as EcoCertApiRawResponse;
      const resultCode = parsed.HEAD?.resultCode ?? "";
      const resultMsg = parsed.HEAD?.resultMsg ?? "";
      if (resultCode !== "00") {
        lastFailure = `ECO_CERT(${resultCode}) ${resultMsg || "UNKNOWN"}`;
        continue;
      }

      const rows = normalizeRows(parsed.DATA?.ROW);
      const totalCount = parsePositiveInt(parsed.HEAD?.totalCount, rows.length);
      const response = buildSuccess<EcoCertListResponseData>({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        message: `친환경 인증정보 조회 성공 (${rows.length}건)`,
        data: {
          totalCount,
          pageNo: parsePositiveInt(parsed.HEAD?.pageNo, pageNo),
          numOfRows: parsePositiveInt(parsed.HEAD?.numOfRows, numOfRows),
          rows,
        },
      });
      await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      httpStatus: lastHttpStatus,
      message: `친환경 인증정보 API 호출 실패 - ${lastFailure}`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
      message: isTimeout
        ? `친환경 인증정보 API 요청 시간 초과 (${timeoutMs}ms)`
        : error instanceof Error
          ? error.message
          : "친환경 인증정보 API 호출 중 네트워크 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function callEcoCertHealthCheck(params: {
  requestId: string;
  timeoutMs?: number;
  appId?: string;
}): Promise<ApiResponse<EcoCertHealthResponseData>> {
  const startedAt = performance.now();
  const result = await callEcoCertList({
    requestId: `${params.requestId}-list`,
    timeoutMs: params.timeoutMs,
    appId: "admin-health-check-list",
    request: {
      pageNo: 1,
      numOfRows: 5,
    },
  });

  if (!result.ok) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: `친환경 인증정보 연결 확인 실패: ${result.message}`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const response = buildSuccess<EcoCertHealthResponseData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    data: { totalCount: result.data.totalCount },
    message: `친환경 인증정보 API 연결 확인 성공 (${result.data.totalCount}건)`,
  });
  await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
  return response;
}
