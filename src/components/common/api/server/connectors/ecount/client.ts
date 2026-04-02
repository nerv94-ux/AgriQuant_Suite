import type { ApiResponse } from "../../contracts/response";
import { ApiErrorCategory } from "../../contracts/errors";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import { getEcountRuntimeConfig, getEcountSettingsOverview } from "../../admin/providerSettings";
import type {
  EcountGetPurchasesOrderListApiResponse,
  EcountHealthResponseData,
  EcountInventoryBalanceByLocationListRequest,
  EcountInventoryBalanceByLocationRequest,
  EcountInventoryBalanceByLocationResponseData,
  EcountInventoryBalanceListRequest,
  EcountInventoryBalanceRequest,
  EcountInventoryBalanceResponseData,
  EcountLoginApiResponse,
  EcountPurchasesOrderListRequest,
  EcountPurchasesOrderListResponseData,
  EcountProductListRequest,
  EcountProductListResponseData,
  EcountProductSingleRequest,
  EcountProductSingleResponseData,
  EcountViewBasicProductApiResponse,
  EcountViewInventoryBalanceApiResponse,
  EcountZoneApiResponse,
} from "./types";

const SOURCE = "ECOUNT" as const;
const DEFAULT_TIMEOUT_MS = 10_000;

type CallEcountConnectionCheckParams = {
  requestId: string;
  timeoutMs?: number;
  appId?: string;
  ignoreAutoStop?: boolean;
};

type CallEcountViewBasicProductParams = {
  requestId: string;
  request: EcountProductSingleRequest;
  timeoutMs?: number;
  appId?: string;
  ignoreAutoStop?: boolean;
};

type CallEcountGetBasicProductsListParams = {
  requestId: string;
  request: EcountProductListRequest;
  timeoutMs?: number;
  appId?: string;
  ignoreAutoStop?: boolean;
};

type CallEcountViewInventoryBalanceStatusParams = {
  requestId: string;
  request: EcountInventoryBalanceRequest;
  timeoutMs?: number;
  appId?: string;
  ignoreAutoStop?: boolean;
};

type CallEcountGetListInventoryBalanceStatusParams = {
  requestId: string;
  request: EcountInventoryBalanceListRequest;
  timeoutMs?: number;
  appId?: string;
  ignoreAutoStop?: boolean;
};

type CallEcountViewInventoryBalanceStatusByLocationParams = {
  requestId: string;
  request: EcountInventoryBalanceByLocationRequest;
  timeoutMs?: number;
  appId?: string;
  ignoreAutoStop?: boolean;
};

type CallEcountGetListInventoryBalanceStatusByLocationParams = {
  requestId: string;
  request: EcountInventoryBalanceByLocationListRequest;
  timeoutMs?: number;
  appId?: string;
  ignoreAutoStop?: boolean;
};

type CallEcountGetPurchasesOrderListParams = {
  requestId: string;
  request: EcountPurchasesOrderListRequest;
  timeoutMs?: number;
  appId?: string;
  ignoreAutoStop?: boolean;
};

function normalizeApiErrorMessage(params: {
  error:
    | {
        Code?: number | string;
        Message?: string;
        MessageDetail?: string;
      }
    | null
    | undefined;
  fallback: string;
}) {
  if (!params.error) {
    return params.fallback;
  }

  const rawCode = params.error.Code;
  const code =
    typeof rawCode === "number"
      ? String(rawCode)
      : typeof rawCode === "string" && rawCode.trim().length > 0
        ? rawCode.trim()
        : null;
  const message = params.error.Message?.trim() ?? "";
  const detail = params.error.MessageDetail?.trim() ?? "";

  if (code && message) {
    return `ECOUNT(${code}) ${message}${detail ? ` - ${detail}` : ""}`;
  }

  if (message) {
    return detail ? `${message} - ${detail}` : message;
  }

  return params.fallback;
}

function buildApiFailureMessage(params: {
  apiName:
    | "Zone"
    | "Login"
    | "ViewBasicProduct"
    | "GetBasicProductsList"
    | "ViewInventoryBalanceStatus"
    | "GetListInventoryBalanceStatus"
    | "ViewInventoryBalanceStatusByLocation"
    | "GetListInventoryBalanceStatusByLocation"
    | "GetPurchasesOrderList";
  status?: string;
  error:
    | {
        Code?: number | string;
        Message?: string;
        MessageDetail?: string;
      }
    | null
    | undefined;
  checks: Array<{ label: string; ok: boolean; value?: string | null }>;
  defaultMessage: string;
}) {
  const errorMessage = normalizeApiErrorMessage({
    error: params.error,
    fallback: params.defaultMessage,
  });

  const checkSummary = params.checks
    .map((check) => `${check.label}=${check.ok ? "OK" : "FAIL"}${check.value ? `(${check.value})` : ""}`)
    .join(", ");

  const statusText = params.status ? `Status=${params.status}` : "Status=없음";
  return `${params.apiName} API 실패: ${errorMessage} | ${statusText} | ${checkSummary}`;
}

function normalizeStatusCode(status: unknown): string | null {
  if (typeof status === "number" && Number.isFinite(status)) {
    return String(status);
  }
  if (typeof status === "string") {
    const trimmed = status.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function parseEcountResultArray(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row)
    );
  }

  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result);
      return parseEcountResultArray(parsed);
    } catch {
      return [];
    }
  }

  return [];
}

async function runEcountZoneLoginHandshake(params: {
  requestId: string;
  startedAt: number;
  timeoutMs: number;
  runtimeConfig: Awaited<ReturnType<typeof getEcountRuntimeConfig>>;
}): Promise<
  | {
      ok: true;
      data: { zone: string; domain: string; sessionId: string };
    }
  | {
      ok: false;
      response: ApiResponse<never>;
    }
> {
  const { requestId, startedAt, timeoutMs, runtimeConfig } = params;
  const zoneHost = runtimeConfig.envMode === "test" ? "https://sboapi.ecount.com" : "https://oapi.ecount.com";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const zoneRes = await fetch(`${zoneHost}/OAPI/V2/Zone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ COM_CODE: runtimeConfig.comCode }),
      signal: controller.signal,
    });

    if (!zoneRes.ok) {
      return {
        ok: false,
        response: buildError({
          source: SOURCE,
          requestId,
          startedAt,
          httpStatus: zoneRes.status,
          message: `eCount Zone API 호출 실패 (HTTP ${zoneRes.status})`,
        }),
      };
    }

    const zoneBody = (await zoneRes.json()) as EcountZoneApiResponse;
    const zoneStatus = normalizeStatusCode(zoneBody.Status);
    const zoneStatusOk = zoneStatus === "200";

    if (zoneBody.Error || !zoneStatusOk || !zoneBody.Data?.ZONE || !zoneBody.Data?.DOMAIN) {
      const message = buildApiFailureMessage({
        apiName: "Zone",
        status: zoneStatus ?? undefined,
        error: zoneBody.Error,
        defaultMessage: "eCount Zone 정보를 가져오지 못했습니다.",
        checks: [
          { label: "Status=200", ok: zoneStatusOk, value: zoneStatus },
          { label: "Error=null", ok: !zoneBody.Error },
          { label: "ZONE", ok: Boolean(zoneBody.Data?.ZONE), value: zoneBody.Data?.ZONE ?? null },
          { label: "DOMAIN", ok: Boolean(zoneBody.Data?.DOMAIN), value: zoneBody.Data?.DOMAIN ?? null },
          { label: "COM_CODE", ok: true, value: runtimeConfig.comCode },
          { label: "ENV", ok: true, value: runtimeConfig.envMode },
        ],
      });

      return {
        ok: false,
        response: buildError({
          source: SOURCE,
          requestId,
          startedAt,
          errorCategory: ApiErrorCategory.AUTH_ERROR,
          message,
        }),
      };
    }

    const resolvedZone = zoneBody.Data.ZONE;
    const resolvedDomain = zoneBody.Data.DOMAIN;

    if (runtimeConfig.zone && runtimeConfig.zone !== resolvedZone) {
      return {
        ok: false,
        response: buildError({
          source: SOURCE,
          requestId,
          startedAt,
          errorCategory: ApiErrorCategory.VALIDATION_ERROR,
          message: `설정된 ZONE(${runtimeConfig.zone})과 Zone API 응답(${resolvedZone})이 다릅니다.`,
        }),
      };
    }

    const apiHost =
      runtimeConfig.envMode === "test"
        ? `https://sboapi${resolvedZone}.ecount.com`
        : `https://oapi${resolvedZone}.ecount.com`;

    const loginRes = await fetch(`${apiHost}/OAPI/V2/OAPILogin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        COM_CODE: runtimeConfig.comCode,
        USER_ID: runtimeConfig.userId,
        API_CERT_KEY: runtimeConfig.apiCertKey,
        LAN_TYPE: runtimeConfig.lanType,
        ZONE: resolvedZone,
      }),
      signal: controller.signal,
    });

    if (!loginRes.ok) {
      return {
        ok: false,
        response: buildError({
          source: SOURCE,
          requestId,
          startedAt,
          httpStatus: loginRes.status,
          message: `eCount Login API 호출 실패 (HTTP ${loginRes.status})`,
        }),
      };
    }

    const loginBody = (await loginRes.json()) as EcountLoginApiResponse;
    const sessionId = loginBody.Data?.Datas?.SESSION_ID?.trim();

    const loginStatus = normalizeStatusCode(loginBody.Status);
    const loginStatusOk = loginStatus === "200";

    if (loginBody.Error || !loginStatusOk || !sessionId) {
      const message = buildApiFailureMessage({
        apiName: "Login",
        status: loginStatus ?? undefined,
        error: loginBody.Error,
        defaultMessage: "eCount 로그인에 실패했습니다.",
        checks: [
          { label: "Status=200", ok: loginStatusOk, value: loginStatus },
          { label: "Error=null", ok: !loginBody.Error },
          { label: "SESSION_ID", ok: Boolean(sessionId), value: sessionId ? "발급됨" : null },
          { label: "ZONE", ok: true, value: resolvedZone },
          { label: "ENV", ok: true, value: runtimeConfig.envMode },
        ],
      });

      return {
        ok: false,
        response: buildError({
          source: SOURCE,
          requestId,
          startedAt,
          errorCategory: ApiErrorCategory.AUTH_ERROR,
          message,
        }),
      };
    }

    return {
      ok: true,
      data: {
        zone: resolvedZone,
        domain: resolvedDomain,
        sessionId,
      },
    };
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      response: buildError({
        source: SOURCE,
        requestId,
        startedAt,
        errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
        message: isTimeout
          ? `eCount 연결 확인 시간 초과 (${timeoutMs}ms)`
          : error instanceof Error
            ? error.message
            : "eCount 연결 확인 중 네트워크 오류가 발생했습니다.",
      }),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function callEcountConnectionCheck(
  params: CallEcountConnectionCheckParams
): Promise<ApiResponse<EcountHealthResponseData>> {
  const startedAt = performance.now();
  const [runtimeConfig, overview] = await Promise.all([
    getEcountRuntimeConfig(),
    getEcountSettingsOverview(),
  ]);
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const appId = params.appId;

  if (!runtimeConfig.enabled) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.DISABLED,
      message: "eCount 커넥터가 관리자 설정에서 비활성화되어 있습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!runtimeConfig.comCode || !runtimeConfig.userId || !runtimeConfig.apiCertKey) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "eCount 연결 확인에 필요한 COM_CODE, USER_ID, API_CERT_KEY를 먼저 설정해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (overview.health.autoStopped && !params.ignoreAutoStop) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.RATE_LIMIT,
      message:
        `최근 로그인 실패가 누적되어 자동 중지 상태입니다. 실패 누적(6h): ${overview.health.recentFailureCount}회. 설정값 점검 후 수동 확인을 진행해 주세요.`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const handshake = await runEcountZoneLoginHandshake({
    requestId: params.requestId,
    startedAt,
    timeoutMs,
    runtimeConfig,
  });

  if (!handshake.ok) {
    await saveApiLog({ ok: false, meta: handshake.response.meta, appId, message: handshake.response.message });
    return handshake.response as ApiResponse<EcountHealthResponseData>;
  }

  try {
    const response = buildSuccess<EcountHealthResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      data: {
        comCode: runtimeConfig.comCode,
        userId: runtimeConfig.userId,
        zone: handshake.data.zone,
        domain: handshake.data.domain,
        sessionId: handshake.data.sessionId,
      },
      message: "eCount Zone + Login 연결 확인에 성공했습니다.",
      extra: {
        envMode: runtimeConfig.envMode,
        lanType: runtimeConfig.lanType,
      },
    });

    await saveApiLog({ ok: true, meta: response.meta, appId, message: response.message });
    return response;
  } catch {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.UNKNOWN,
      message: "eCount 연결 확인 후 응답 처리 중 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }
}

export async function callEcountViewBasicProduct(
  params: CallEcountViewBasicProductParams
): Promise<ApiResponse<EcountProductSingleResponseData>> {
  const startedAt = performance.now();
  const [runtimeConfig, overview] = await Promise.all([
    getEcountRuntimeConfig(),
    getEcountSettingsOverview(),
  ]);
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const appId = params.appId;

  if (!runtimeConfig.enabled) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.DISABLED,
      message: "eCount 커넥터가 관리자 설정에서 비활성화되어 있습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!runtimeConfig.comCode || !runtimeConfig.userId || !runtimeConfig.apiCertKey) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "품목조회에 필요한 COM_CODE, USER_ID, API_CERT_KEY를 먼저 설정해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (overview.health.autoStopped && !params.ignoreAutoStop) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.RATE_LIMIT,
      message:
        `최근 로그인 실패가 누적되어 자동 중지 상태입니다. 실패 누적(6h): ${overview.health.recentFailureCount}회. 설정값 점검 후 수동 확인을 진행해 주세요.`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const prodCode = params.request.prodCode.trim();
  const prodType = params.request.prodType?.trim();
  if (!prodCode || prodCode.length > 20) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "PROD_CD는 1~20자여야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (prodType && prodType.length > 20) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "PROD_TYPE은 최대 20자여야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const handshake = await runEcountZoneLoginHandshake({
    requestId: params.requestId,
    startedAt,
    timeoutMs,
    runtimeConfig,
  });
  if (!handshake.ok) {
    await saveApiLog({ ok: false, meta: handshake.response.meta, appId, message: handshake.response.message });
    return handshake.response as ApiResponse<EcountProductSingleResponseData>;
  }

  const apiHost =
    runtimeConfig.envMode === "test"
      ? `https://sboapi${handshake.data.zone}.ecount.com`
      : `https://oapi${handshake.data.zone}.ecount.com`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${apiHost}/OAPI/V2/InventoryBasic/ViewBasicProduct?SESSION_ID=${encodeURIComponent(
      handshake.data.sessionId
    )}`;
    const body: Record<string, string> = { PROD_CD: prodCode };
    if (prodType) {
      body.PROD_TYPE = prodType;
    }

    const productRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!productRes.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: productRes.status,
        message: `eCount 품목조회 API 호출 실패 (HTTP ${productRes.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const productBody = (await productRes.json()) as EcountViewBasicProductApiResponse;
    const productStatus = normalizeStatusCode(productBody.Status);
    const productStatusOk = productStatus === "200";
    const rows = parseEcountResultArray(productBody.Data?.Result);
    const targetRow =
      rows.find((row) => String(row.PROD_CD ?? "").trim() === prodCode) ??
      rows.find((row) => Boolean(row.PROD_CD)) ??
      null;

    if (productBody.Error || !productStatusOk || !targetRow) {
      const message = buildApiFailureMessage({
        apiName: "ViewBasicProduct",
        status: productStatus ?? undefined,
        error: productBody.Error,
        defaultMessage: "eCount 품목조회에 실패했습니다.",
        checks: [
          { label: "Status=200", ok: productStatusOk, value: productStatus },
          { label: "Error=null", ok: !productBody.Error },
          { label: "ResultCount>0", ok: rows.length > 0, value: String(rows.length) },
          { label: "PROD_CD", ok: Boolean(targetRow), value: prodCode },
        ],
      });
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: ApiErrorCategory.AUTH_ERROR,
        message,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const response = buildSuccess<EcountProductSingleResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      data: {
        comCode: runtimeConfig.comCode,
        userId: runtimeConfig.userId,
        zone: handshake.data.zone,
        domain: handshake.data.domain,
        sessionId: handshake.data.sessionId,
        traceId: productBody.Data?.TRACE_ID ?? null,
        quantityInfo: productBody.Data?.QUANTITY_INFO ?? null,
        product: targetRow,
      },
      message: `eCount 품목조회 성공 (PROD_CD: ${prodCode})`,
      extra: {
        envMode: runtimeConfig.envMode,
        prodCode,
        prodType: prodType ?? null,
      },
    });
    await saveApiLog({ ok: true, meta: response.meta, appId, message: response.message });
    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
      message: isTimeout
        ? `eCount 품목조회 시간 초과 (${timeoutMs}ms)`
        : error instanceof Error
          ? error.message
          : "eCount 품목조회 중 네트워크 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function callEcountGetBasicProductsList(
  params: CallEcountGetBasicProductsListParams
): Promise<ApiResponse<EcountProductListResponseData>> {
  const startedAt = performance.now();
  const [runtimeConfig, overview] = await Promise.all([
    getEcountRuntimeConfig(),
    getEcountSettingsOverview(),
  ]);
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const appId = params.appId;

  if (!runtimeConfig.enabled) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.DISABLED,
      message: "eCount 커넥터가 관리자 설정에서 비활성화되어 있습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!runtimeConfig.comCode || !runtimeConfig.userId || !runtimeConfig.apiCertKey) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "품목 목록조회에 필요한 COM_CODE, USER_ID, API_CERT_KEY를 먼저 설정해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (overview.health.autoStopped && !params.ignoreAutoStop) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.RATE_LIMIT,
      message:
        `최근 로그인 실패가 누적되어 자동 중지 상태입니다. 실패 누적(6h): ${overview.health.recentFailureCount}회. 설정값 점검 후 수동 확인을 진행해 주세요.`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const prodCode = params.request.prodCode?.trim() ?? "";
  const prodType = params.request.prodType?.trim() ?? "";
  const fromProdCd = params.request.fromProdCd?.trim() ?? "";
  const toProdCd = params.request.toProdCd?.trim() ?? "";
  const commaFlag = params.request.commaFlag;

  if (commaFlag !== undefined && commaFlag !== "Y" && commaFlag !== "N") {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "COMMA_FLAG는 Y 또는 N만 허용됩니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (prodCode.length > 20_000) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "PROD_CD는 최대 20000자까지 입력할 수 있습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (prodType.length > 20) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "PROD_TYPE은 최대 20자여야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const hasPartialRange = Boolean(fromProdCd) !== Boolean(toProdCd);
  if (hasPartialRange) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "FROM_PROD_CD와 TO_PROD_CD는 함께 입력해야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (fromProdCd && toProdCd && (fromProdCd.length > 20 || toProdCd.length > 20)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "FROM_PROD_CD, TO_PROD_CD는 각각 최대 20자입니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const hasProdCode = prodCode.length > 0;
  const hasRange = Boolean(fromProdCd && toProdCd);
  const hasProdType = prodType.length > 0;
  if (!hasProdCode && !hasRange && !hasProdType) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message:
        "조회 조건을 하나 이상 입력하세요. (PROD_CD, FROM/TO 품목코드 범위, 또는 PROD_TYPE) 전체 품목 무제한 조회는 호출량·차단 위험으로 서버에서 막았습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const handshake = await runEcountZoneLoginHandshake({
    requestId: params.requestId,
    startedAt,
    timeoutMs,
    runtimeConfig,
  });
  if (!handshake.ok) {
    await saveApiLog({ ok: false, meta: handshake.response.meta, appId, message: handshake.response.message });
    return handshake.response as ApiResponse<EcountProductListResponseData>;
  }

  const apiHost =
    runtimeConfig.envMode === "test"
      ? `https://sboapi${handshake.data.zone}.ecount.com`
      : `https://oapi${handshake.data.zone}.ecount.com`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${apiHost}/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID=${encodeURIComponent(
      handshake.data.sessionId
    )}`;
    const body: Record<string, string> = {};
    if (hasProdCode) {
      body.PROD_CD = prodCode;
    }
    if (commaFlag) {
      body.COMMA_FLAG = commaFlag;
    }
    if (hasProdType) {
      body.PROD_TYPE = prodType;
    }
    if (hasRange) {
      body.FROM_PROD_CD = fromProdCd;
      body.TO_PROD_CD = toProdCd;
    }

    const productRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!productRes.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: productRes.status,
        message: `eCount 품목 목록조회 API 호출 실패 (HTTP ${productRes.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const productBody = (await productRes.json()) as EcountViewBasicProductApiResponse;
    const productStatus = normalizeStatusCode(productBody.Status);
    const productStatusOk = productStatus === "200";
    const rows = parseEcountResultArray(productBody.Data?.Result);

    if (productBody.Error || !productStatusOk) {
      const message = buildApiFailureMessage({
        apiName: "GetBasicProductsList",
        status: productStatus ?? undefined,
        error: productBody.Error,
        defaultMessage: "eCount 품목 목록조회에 실패했습니다.",
        checks: [
          { label: "Status=200", ok: productStatusOk, value: productStatus },
          { label: "Error=null", ok: !productBody.Error },
          { label: "ResultCount", ok: true, value: String(rows.length) },
        ],
      });
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: ApiErrorCategory.AUTH_ERROR,
        message,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const response = buildSuccess<EcountProductListResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      data: {
        comCode: runtimeConfig.comCode,
        userId: runtimeConfig.userId,
        zone: handshake.data.zone,
        domain: handshake.data.domain,
        sessionId: handshake.data.sessionId,
        traceId: productBody.Data?.TRACE_ID ?? null,
        quantityInfo: productBody.Data?.QUANTITY_INFO ?? null,
        products: rows,
      },
      message: `eCount 품목 목록조회 성공 (${rows.length}건)`,
      extra: {
        envMode: runtimeConfig.envMode,
        prodCode: hasProdCode ? prodCode : null,
        commaFlag: commaFlag ?? null,
        prodType: hasProdType ? prodType : null,
        fromProdCd: hasRange ? fromProdCd : null,
        toProdCd: hasRange ? toProdCd : null,
      },
    });
    await saveApiLog({ ok: true, meta: response.meta, appId, message: response.message });
    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
      message: isTimeout
        ? `eCount 품목 목록조회 시간 초과 (${timeoutMs}ms)`
        : error instanceof Error
          ? error.message
          : "eCount 품목 목록조회 중 네트워크 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function callEcountViewInventoryBalanceStatus(
  params: CallEcountViewInventoryBalanceStatusParams
): Promise<ApiResponse<EcountInventoryBalanceResponseData>> {
  const startedAt = performance.now();
  const [runtimeConfig, overview] = await Promise.all([
    getEcountRuntimeConfig(),
    getEcountSettingsOverview(),
  ]);
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const appId = params.appId;

  if (!runtimeConfig.enabled) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.DISABLED,
      message: "eCount 커넥터가 관리자 설정에서 비활성화되어 있습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!runtimeConfig.comCode || !runtimeConfig.userId || !runtimeConfig.apiCertKey) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "재고현황 조회에 필요한 COM_CODE, USER_ID, API_CERT_KEY를 먼저 설정해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (overview.health.autoStopped && !params.ignoreAutoStop) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.RATE_LIMIT,
      message:
        `최근 로그인 실패가 누적되어 자동 중지 상태입니다. 실패 누적(6h): ${overview.health.recentFailureCount}회. 설정값 점검 후 수동 확인을 진행해 주세요.`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const baseDate = params.request.baseDate.trim();
  const prodCode = params.request.prodCode.trim();
  const whCd = params.request.whCd?.trim() ?? "";
  const zeroFlag = params.request.zeroFlag ?? "N";
  const balFlag = params.request.balFlag ?? "N";
  const delGubun = params.request.delGubun ?? "N";
  const safeFlag = params.request.safeFlag ?? "N";

  if (!/^\d{8}$/.test(baseDate)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "BASE_DATE는 YYYYMMDD 형식(8자리 숫자)이어야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!prodCode || prodCode.length > 20) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "PROD_CD는 필수이며 최대 20자여야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (whCd.length > 8000) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "WH_CD는 최대 8000자입니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const flags: Array<{ label: string; value: string }> = [
    { label: "ZERO_FLAG", value: zeroFlag },
    { label: "BAL_FLAG", value: balFlag },
    { label: "DEL_GUBUN", value: delGubun },
    { label: "SAFE_FLAG", value: safeFlag },
  ];
  const invalidFlag = flags.find(({ value }) => value !== "Y" && value !== "N");
  if (invalidFlag) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: `${invalidFlag.label}는 Y 또는 N만 허용됩니다.`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const handshake = await runEcountZoneLoginHandshake({
    requestId: params.requestId,
    startedAt,
    timeoutMs,
    runtimeConfig,
  });
  if (!handshake.ok) {
    await saveApiLog({ ok: false, meta: handshake.response.meta, appId, message: handshake.response.message });
    return handshake.response as ApiResponse<EcountInventoryBalanceResponseData>;
  }

  const apiHost =
    runtimeConfig.envMode === "test"
      ? `https://sboapi${handshake.data.zone}.ecount.com`
      : `https://oapi${handshake.data.zone}.ecount.com`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${apiHost}/OAPI/V2/InventoryBalance/ViewInventoryBalanceStatus?SESSION_ID=${encodeURIComponent(
      handshake.data.sessionId
    )}`;
    const body: Record<string, string> = {
      BASE_DATE: baseDate,
      PROD_CD: prodCode,
      ZERO_FLAG: zeroFlag,
      BAL_FLAG: balFlag,
      DEL_GUBUN: delGubun,
      SAFE_FLAG: safeFlag,
    };
    if (whCd) {
      body.WH_CD = whCd;
    }

    const balanceRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!balanceRes.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: balanceRes.status,
        message: `eCount 재고현황 API 호출 실패 (HTTP ${balanceRes.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const balanceBody = (await balanceRes.json()) as EcountViewInventoryBalanceApiResponse;
    const balanceStatus = normalizeStatusCode(balanceBody.Status);
    const balanceStatusOk = balanceStatus === "200";
    const rows = parseEcountResultArray(balanceBody.Data?.Result);
    const normalizedItems = rows
      .map((row) => {
        const rowProdCode = String(row.PROD_CD ?? "").trim();
        const rowBalQty = String(row.BAL_QTY ?? "").trim();
        if (!rowProdCode) {
          return null;
        }
        return {
          prodCode: rowProdCode,
          balQty: rowBalQty,
          raw: row,
        };
      })
      .filter((row): row is { prodCode: string; balQty: string; raw: Record<string, unknown> } => Boolean(row));

    if (balanceBody.Error || !balanceStatusOk) {
      const message = buildApiFailureMessage({
        apiName: "ViewInventoryBalanceStatus",
        status: balanceStatus ?? undefined,
        error: balanceBody.Error,
        defaultMessage: "eCount 재고현황 조회에 실패했습니다.",
        checks: [
          { label: "Status=200", ok: balanceStatusOk, value: balanceStatus },
          { label: "Error=null", ok: !balanceBody.Error },
          { label: "ResultCount", ok: true, value: String(normalizedItems.length) },
          { label: "BASE_DATE", ok: true, value: baseDate },
          { label: "PROD_CD", ok: true, value: prodCode },
        ],
      });
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: ApiErrorCategory.AUTH_ERROR,
        message,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const rawTotal = balanceBody.Data?.TotalCnt;
    const totalCount =
      typeof rawTotal === "number"
        ? rawTotal
        : typeof rawTotal === "string" && rawTotal.trim().length > 0
          ? Number(rawTotal)
          : normalizedItems.length;

    const response = buildSuccess<EcountInventoryBalanceResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      data: {
        comCode: runtimeConfig.comCode,
        userId: runtimeConfig.userId,
        zone: handshake.data.zone,
        domain: handshake.data.domain,
        sessionId: handshake.data.sessionId,
        traceId: balanceBody.Data?.TRACE_ID ?? null,
        quantityInfo: balanceBody.Data?.QUANTITY_INFO ?? null,
        totalCount: Number.isFinite(totalCount) ? totalCount : normalizedItems.length,
        items: normalizedItems,
      },
      message: `eCount 재고현황 조회 성공 (${normalizedItems.length}건)`,
      extra: {
        envMode: runtimeConfig.envMode,
        baseDate,
        prodCode,
        whCd: whCd || null,
        zeroFlag,
        balFlag,
        delGubun,
        safeFlag,
      },
    });
    await saveApiLog({ ok: true, meta: response.meta, appId, message: response.message });
    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
      message: isTimeout
        ? `eCount 재고현황 조회 시간 초과 (${timeoutMs}ms)`
        : error instanceof Error
          ? error.message
          : "eCount 재고현황 조회 중 네트워크 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function callEcountGetListInventoryBalanceStatus(
  params: CallEcountGetListInventoryBalanceStatusParams
): Promise<ApiResponse<EcountInventoryBalanceResponseData>> {
  const startedAt = performance.now();
  const [runtimeConfig, overview] = await Promise.all([
    getEcountRuntimeConfig(),
    getEcountSettingsOverview(),
  ]);
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const appId = params.appId;

  if (!runtimeConfig.enabled) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.DISABLED,
      message: "eCount 커넥터가 관리자 설정에서 비활성화되어 있습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!runtimeConfig.comCode || !runtimeConfig.userId || !runtimeConfig.apiCertKey) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "재고현황(목록) 조회에 필요한 COM_CODE, USER_ID, API_CERT_KEY를 먼저 설정해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (overview.health.autoStopped && !params.ignoreAutoStop) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.RATE_LIMIT,
      message:
        `최근 로그인 실패가 누적되어 자동 중지 상태입니다. 실패 누적(6h): ${overview.health.recentFailureCount}회. 설정값 점검 후 수동 확인을 진행해 주세요.`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const baseDate = params.request.baseDate.trim();
  const prodCode = params.request.prodCode?.trim() ?? "";
  const whCd = params.request.whCd?.trim() ?? "";
  const zeroFlag = params.request.zeroFlag ?? "N";
  const balFlag = params.request.balFlag ?? "N";
  const delGubun = params.request.delGubun ?? "N";
  const safeFlag = params.request.safeFlag ?? "N";

  if (!/^\d{8}$/.test(baseDate)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "BASE_DATE는 YYYYMMDD 형식(8자리 숫자)이어야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (prodCode.length > 20) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "PROD_CD는 최대 20자여야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (whCd.length > 8000) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "WH_CD는 최대 8000자입니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const flags: Array<{ label: string; value: string }> = [
    { label: "ZERO_FLAG", value: zeroFlag },
    { label: "BAL_FLAG", value: balFlag },
    { label: "DEL_GUBUN", value: delGubun },
    { label: "SAFE_FLAG", value: safeFlag },
  ];
  const invalidFlag = flags.find(({ value }) => value !== "Y" && value !== "N");
  if (invalidFlag) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: `${invalidFlag.label}는 Y 또는 N만 허용됩니다.`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const handshake = await runEcountZoneLoginHandshake({
    requestId: params.requestId,
    startedAt,
    timeoutMs,
    runtimeConfig,
  });
  if (!handshake.ok) {
    await saveApiLog({ ok: false, meta: handshake.response.meta, appId, message: handshake.response.message });
    return handshake.response as ApiResponse<EcountInventoryBalanceResponseData>;
  }

  const apiHost =
    runtimeConfig.envMode === "test"
      ? `https://sboapi${handshake.data.zone}.ecount.com`
      : `https://oapi${handshake.data.zone}.ecount.com`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${apiHost}/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatus?SESSION_ID=${encodeURIComponent(
      handshake.data.sessionId
    )}`;
    const body: Record<string, string> = {
      BASE_DATE: baseDate,
      ZERO_FLAG: zeroFlag,
      BAL_FLAG: balFlag,
      DEL_GUBUN: delGubun,
      SAFE_FLAG: safeFlag,
    };
    if (prodCode) {
      body.PROD_CD = prodCode;
    }
    if (whCd) {
      body.WH_CD = whCd;
    }

    const balanceRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!balanceRes.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: balanceRes.status,
        message: `eCount 재고현황(목록) API 호출 실패 (HTTP ${balanceRes.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const balanceBody = (await balanceRes.json()) as EcountViewInventoryBalanceApiResponse;
    const balanceStatus = normalizeStatusCode(balanceBody.Status);
    const balanceStatusOk = balanceStatus === "200";
    const rows = parseEcountResultArray(balanceBody.Data?.Result);
    const normalizedItems = rows
      .map((row) => {
        const rowProdCode = String(row.PROD_CD ?? "").trim();
        const rowBalQty = String(row.BAL_QTY ?? "").trim();
        if (!rowProdCode) {
          return null;
        }
        return {
          prodCode: rowProdCode,
          balQty: rowBalQty,
          raw: row,
        };
      })
      .filter((row): row is { prodCode: string; balQty: string; raw: Record<string, unknown> } => Boolean(row));

    if (balanceBody.Error || !balanceStatusOk) {
      const message = buildApiFailureMessage({
        apiName: "GetListInventoryBalanceStatus",
        status: balanceStatus ?? undefined,
        error: balanceBody.Error,
        defaultMessage: "eCount 재고현황(목록) 조회에 실패했습니다.",
        checks: [
          { label: "Status=200", ok: balanceStatusOk, value: balanceStatus },
          { label: "Error=null", ok: !balanceBody.Error },
          { label: "ResultCount", ok: true, value: String(normalizedItems.length) },
          { label: "BASE_DATE", ok: true, value: baseDate },
          { label: "PROD_CD(optional)", ok: true, value: prodCode || "미입력" },
        ],
      });
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: ApiErrorCategory.AUTH_ERROR,
        message,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const rawTotal = balanceBody.Data?.TotalCnt;
    const totalCount =
      typeof rawTotal === "number"
        ? rawTotal
        : typeof rawTotal === "string" && rawTotal.trim().length > 0
          ? Number(rawTotal)
          : normalizedItems.length;

    const response = buildSuccess<EcountInventoryBalanceResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      data: {
        comCode: runtimeConfig.comCode,
        userId: runtimeConfig.userId,
        zone: handshake.data.zone,
        domain: handshake.data.domain,
        sessionId: handshake.data.sessionId,
        traceId: balanceBody.Data?.TRACE_ID ?? null,
        quantityInfo: balanceBody.Data?.QUANTITY_INFO ?? null,
        totalCount: Number.isFinite(totalCount) ? totalCount : normalizedItems.length,
        items: normalizedItems,
      },
      message: `eCount 재고현황(목록) 조회 성공 (${normalizedItems.length}건)`,
      extra: {
        envMode: runtimeConfig.envMode,
        baseDate,
        prodCode: prodCode || null,
        whCd: whCd || null,
        zeroFlag,
        balFlag,
        delGubun,
        safeFlag,
      },
    });
    await saveApiLog({ ok: true, meta: response.meta, appId, message: response.message });
    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
      message: isTimeout
        ? `eCount 재고현황(목록) 조회 시간 초과 (${timeoutMs}ms)`
        : error instanceof Error
          ? error.message
          : "eCount 재고현황(목록) 조회 중 네트워크 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function callEcountViewInventoryBalanceStatusByLocation(
  params: CallEcountViewInventoryBalanceStatusByLocationParams
): Promise<ApiResponse<EcountInventoryBalanceByLocationResponseData>> {
  const startedAt = performance.now();
  const [runtimeConfig, overview] = await Promise.all([
    getEcountRuntimeConfig(),
    getEcountSettingsOverview(),
  ]);
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const appId = params.appId;

  if (!runtimeConfig.enabled) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.DISABLED,
      message: "eCount 커넥터가 관리자 설정에서 비활성화되어 있습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!runtimeConfig.comCode || !runtimeConfig.userId || !runtimeConfig.apiCertKey) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "창고별 재고현황 조회에 필요한 COM_CODE, USER_ID, API_CERT_KEY를 먼저 설정해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (overview.health.autoStopped && !params.ignoreAutoStop) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.RATE_LIMIT,
      message:
        `최근 로그인 실패가 누적되어 자동 중지 상태입니다. 실패 누적(6h): ${overview.health.recentFailureCount}회. 설정값 점검 후 수동 확인을 진행해 주세요.`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const baseDate = params.request.baseDate.trim();
  const prodCode = params.request.prodCode.trim();
  const whCd = params.request.whCd?.trim() ?? "";
  const balFlag = params.request.balFlag ?? "N";
  const delGubun = params.request.delGubun ?? "N";
  const delLocationYn = params.request.delLocationYn ?? "N";

  if (!/^\d{8}$/.test(baseDate)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "BASE_DATE는 YYYYMMDD 형식(8자리 숫자)이어야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!prodCode || prodCode.length > 20) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "PROD_CD는 필수이며 최대 20자여야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (whCd.length > 700) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "WH_CD는 최대 700자입니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const flags: Array<{ label: string; value: string }> = [
    { label: "BAL_FLAG", value: balFlag },
    { label: "DEL_GUBUN", value: delGubun },
    { label: "DEL_LOCATION_YN", value: delLocationYn },
  ];
  const invalidFlag = flags.find(({ value }) => value !== "Y" && value !== "N");
  if (invalidFlag) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: `${invalidFlag.label}는 Y 또는 N만 허용됩니다.`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const handshake = await runEcountZoneLoginHandshake({
    requestId: params.requestId,
    startedAt,
    timeoutMs,
    runtimeConfig,
  });
  if (!handshake.ok) {
    await saveApiLog({ ok: false, meta: handshake.response.meta, appId, message: handshake.response.message });
    return handshake.response as ApiResponse<EcountInventoryBalanceByLocationResponseData>;
  }

  const apiHost =
    runtimeConfig.envMode === "test"
      ? `https://sboapi${handshake.data.zone}.ecount.com`
      : `https://oapi${handshake.data.zone}.ecount.com`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${apiHost}/OAPI/V2/InventoryBalance/ViewInventoryBalanceStatusByLocation?SESSION_ID=${encodeURIComponent(
      handshake.data.sessionId
    )}`;
    const body: Record<string, string> = {
      BASE_DATE: baseDate,
      PROD_CD: prodCode,
      BAL_FLAG: balFlag,
      DEL_GUBUN: delGubun,
      DEL_LOCATION_YN: delLocationYn,
    };
    if (whCd) {
      body.WH_CD = whCd;
    }

    const balanceRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!balanceRes.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: balanceRes.status,
        message: `eCount 창고별 재고현황 API 호출 실패 (HTTP ${balanceRes.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const balanceBody = (await balanceRes.json()) as EcountViewInventoryBalanceApiResponse;
    const balanceStatus = normalizeStatusCode(balanceBody.Status);
    const balanceStatusOk = balanceStatus === "200";
    const rows = parseEcountResultArray(balanceBody.Data?.Result);
    const normalizedItems = rows
      .map((row) => {
        const whCode = String(row.WH_CD ?? "").trim();
        const whDes = String(row.WH_DES ?? "").trim();
        const rowProdCode = String(row.PROD_CD ?? "").trim();
        const prodDes = String(row.PROD_DES ?? "").trim();
        const prodSizeDes = String(row.PROD_SIZE_DES ?? "").trim();
        const rowBalQty = String(row.BAL_QTY ?? "").trim();
        if (!whCode || !rowProdCode) {
          return null;
        }
        return {
          whCd: whCode,
          whDes,
          prodCode: rowProdCode,
          prodDes,
          prodSizeDes,
          balQty: rowBalQty,
          raw: row,
        };
      })
      .filter(
        (
          row
        ): row is {
          whCd: string;
          whDes: string;
          prodCode: string;
          prodDes: string;
          prodSizeDes: string;
          balQty: string;
          raw: Record<string, unknown>;
        } => Boolean(row)
      );

    if (balanceBody.Error || !balanceStatusOk) {
      const message = buildApiFailureMessage({
        apiName: "ViewInventoryBalanceStatusByLocation",
        status: balanceStatus ?? undefined,
        error: balanceBody.Error,
        defaultMessage: "eCount 창고별 재고현황 조회에 실패했습니다.",
        checks: [
          { label: "Status=200", ok: balanceStatusOk, value: balanceStatus },
          { label: "Error=null", ok: !balanceBody.Error },
          { label: "ResultCount", ok: true, value: String(normalizedItems.length) },
          { label: "BASE_DATE", ok: true, value: baseDate },
          { label: "PROD_CD", ok: true, value: prodCode },
        ],
      });
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: ApiErrorCategory.AUTH_ERROR,
        message,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const rawTotal = balanceBody.Data?.TotalCnt;
    const totalCount =
      typeof rawTotal === "number"
        ? rawTotal
        : typeof rawTotal === "string" && rawTotal.trim().length > 0
          ? Number(rawTotal)
          : normalizedItems.length;

    const response = buildSuccess<EcountInventoryBalanceByLocationResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      data: {
        comCode: runtimeConfig.comCode,
        userId: runtimeConfig.userId,
        zone: handshake.data.zone,
        domain: handshake.data.domain,
        sessionId: handshake.data.sessionId,
        traceId: balanceBody.Data?.TRACE_ID ?? null,
        quantityInfo: balanceBody.Data?.QUANTITY_INFO ?? null,
        totalCount: Number.isFinite(totalCount) ? totalCount : normalizedItems.length,
        items: normalizedItems,
      },
      message: `eCount 창고별 재고현황 조회 성공 (${normalizedItems.length}건)`,
      extra: {
        envMode: runtimeConfig.envMode,
        baseDate,
        prodCode,
        whCd: whCd || null,
        balFlag,
        delGubun,
        delLocationYn,
      },
    });
    await saveApiLog({ ok: true, meta: response.meta, appId, message: response.message });
    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
      message: isTimeout
        ? `eCount 창고별 재고현황 조회 시간 초과 (${timeoutMs}ms)`
        : error instanceof Error
          ? error.message
          : "eCount 창고별 재고현황 조회 중 네트워크 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function callEcountGetListInventoryBalanceStatusByLocation(
  params: CallEcountGetListInventoryBalanceStatusByLocationParams
): Promise<ApiResponse<EcountInventoryBalanceByLocationResponseData>> {
  const startedAt = performance.now();
  const [runtimeConfig, overview] = await Promise.all([
    getEcountRuntimeConfig(),
    getEcountSettingsOverview(),
  ]);
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const appId = params.appId;

  if (!runtimeConfig.enabled) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.DISABLED,
      message: "eCount 커넥터가 관리자 설정에서 비활성화되어 있습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!runtimeConfig.comCode || !runtimeConfig.userId || !runtimeConfig.apiCertKey) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "창고별 재고현황(목록) 조회에 필요한 COM_CODE, USER_ID, API_CERT_KEY를 먼저 설정해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (overview.health.autoStopped && !params.ignoreAutoStop) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.RATE_LIMIT,
      message:
        `최근 로그인 실패가 누적되어 자동 중지 상태입니다. 실패 누적(6h): ${overview.health.recentFailureCount}회. 설정값 점검 후 수동 확인을 진행해 주세요.`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const baseDate = params.request.baseDate.trim();
  const prodCode = params.request.prodCode?.trim() ?? "";
  const whCd = params.request.whCd?.trim() ?? "";
  const balFlag = params.request.balFlag ?? "N";
  const delGubun = params.request.delGubun ?? "N";
  const delLocationYn = params.request.delLocationYn ?? "N";

  if (!/^\d{8}$/.test(baseDate)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "BASE_DATE는 YYYYMMDD 형식(8자리 숫자)이어야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (prodCode.length > 20) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "PROD_CD는 최대 20자여야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (whCd.length > 700) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "WH_CD는 최대 700자입니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const flags: Array<{ label: string; value: string }> = [
    { label: "BAL_FLAG", value: balFlag },
    { label: "DEL_GUBUN", value: delGubun },
    { label: "DEL_LOCATION_YN", value: delLocationYn },
  ];
  const invalidFlag = flags.find(({ value }) => value !== "Y" && value !== "N");
  if (invalidFlag) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: `${invalidFlag.label}는 Y 또는 N만 허용됩니다.`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const handshake = await runEcountZoneLoginHandshake({
    requestId: params.requestId,
    startedAt,
    timeoutMs,
    runtimeConfig,
  });
  if (!handshake.ok) {
    await saveApiLog({ ok: false, meta: handshake.response.meta, appId, message: handshake.response.message });
    return handshake.response as ApiResponse<EcountInventoryBalanceByLocationResponseData>;
  }

  const apiHost =
    runtimeConfig.envMode === "test"
      ? `https://sboapi${handshake.data.zone}.ecount.com`
      : `https://oapi${handshake.data.zone}.ecount.com`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${apiHost}/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation?SESSION_ID=${encodeURIComponent(
      handshake.data.sessionId
    )}`;
    const body: Record<string, string> = {
      BASE_DATE: baseDate,
      BAL_FLAG: balFlag,
      DEL_GUBUN: delGubun,
      DEL_LOCATION_YN: delLocationYn,
    };
    if (prodCode) {
      body.PROD_CD = prodCode;
    }
    if (whCd) {
      body.WH_CD = whCd;
    }

    const balanceRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!balanceRes.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: balanceRes.status,
        message: `eCount 창고별 재고현황(목록) API 호출 실패 (HTTP ${balanceRes.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const balanceBody = (await balanceRes.json()) as EcountViewInventoryBalanceApiResponse;
    const balanceStatus = normalizeStatusCode(balanceBody.Status);
    const balanceStatusOk = balanceStatus === "200";
    const rows = parseEcountResultArray(balanceBody.Data?.Result);
    const normalizedItems = rows
      .map((row) => {
        const whCode = String(row.WH_CD ?? "").trim();
        const whDes = String(row.WH_DES ?? "").trim();
        const rowProdCode = String(row.PROD_CD ?? "").trim();
        const prodDes = String(row.PROD_DES ?? "").trim();
        const prodSizeDes = String(row.PROD_SIZE_DES ?? "").trim();
        const rowBalQty = String(row.BAL_QTY ?? "").trim();
        if (!whCode || !rowProdCode) {
          return null;
        }
        return {
          whCd: whCode,
          whDes,
          prodCode: rowProdCode,
          prodDes,
          prodSizeDes,
          balQty: rowBalQty,
          raw: row,
        };
      })
      .filter(
        (
          row
        ): row is {
          whCd: string;
          whDes: string;
          prodCode: string;
          prodDes: string;
          prodSizeDes: string;
          balQty: string;
          raw: Record<string, unknown>;
        } => Boolean(row)
      );

    if (balanceBody.Error || !balanceStatusOk) {
      const message = buildApiFailureMessage({
        apiName: "GetListInventoryBalanceStatusByLocation",
        status: balanceStatus ?? undefined,
        error: balanceBody.Error,
        defaultMessage: "eCount 창고별 재고현황(목록) 조회에 실패했습니다.",
        checks: [
          { label: "Status=200", ok: balanceStatusOk, value: balanceStatus },
          { label: "Error=null", ok: !balanceBody.Error },
          { label: "ResultCount", ok: true, value: String(normalizedItems.length) },
          { label: "BASE_DATE", ok: true, value: baseDate },
          { label: "PROD_CD(optional)", ok: true, value: prodCode || "미입력" },
        ],
      });
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: ApiErrorCategory.AUTH_ERROR,
        message,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const rawTotal = balanceBody.Data?.TotalCnt;
    const totalCount =
      typeof rawTotal === "number"
        ? rawTotal
        : typeof rawTotal === "string" && rawTotal.trim().length > 0
          ? Number(rawTotal)
          : normalizedItems.length;

    const response = buildSuccess<EcountInventoryBalanceByLocationResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      data: {
        comCode: runtimeConfig.comCode,
        userId: runtimeConfig.userId,
        zone: handshake.data.zone,
        domain: handshake.data.domain,
        sessionId: handshake.data.sessionId,
        traceId: balanceBody.Data?.TRACE_ID ?? null,
        quantityInfo: balanceBody.Data?.QUANTITY_INFO ?? null,
        totalCount: Number.isFinite(totalCount) ? totalCount : normalizedItems.length,
        items: normalizedItems,
      },
      message: `eCount 창고별 재고현황(목록) 조회 성공 (${normalizedItems.length}건)`,
      extra: {
        envMode: runtimeConfig.envMode,
        baseDate,
        prodCode: prodCode || null,
        whCd: whCd || null,
        balFlag,
        delGubun,
        delLocationYn,
      },
    });
    await saveApiLog({ ok: true, meta: response.meta, appId, message: response.message });
    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
      message: isTimeout
        ? `eCount 창고별 재고현황(목록) 조회 시간 초과 (${timeoutMs}ms)`
        : error instanceof Error
          ? error.message
          : "eCount 창고별 재고현황(목록) 조회 중 네트워크 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function callEcountGetPurchasesOrderList(
  params: CallEcountGetPurchasesOrderListParams
): Promise<ApiResponse<EcountPurchasesOrderListResponseData>> {
  const startedAt = performance.now();
  const [runtimeConfig, overview] = await Promise.all([
    getEcountRuntimeConfig(),
    getEcountSettingsOverview(),
  ]);
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const appId = params.appId;

  if (!runtimeConfig.enabled) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.DISABLED,
      message: "eCount 커넥터가 관리자 설정에서 비활성화되어 있습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!runtimeConfig.comCode || !runtimeConfig.userId || !runtimeConfig.apiCertKey) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "발주서 조회에 필요한 COM_CODE, USER_ID, API_CERT_KEY를 먼저 설정해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (overview.health.autoStopped && !params.ignoreAutoStop) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.RATE_LIMIT,
      message:
        `최근 로그인 실패가 누적되어 자동 중지 상태입니다. 실패 누적(6h): ${overview.health.recentFailureCount}회. 설정값 점검 후 수동 확인을 진행해 주세요.`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const prodCode = params.request.prodCode?.trim() ?? "";
  const custCode = params.request.custCode?.trim() ?? "";
  const baseDateFrom = params.request.baseDateFrom.trim();
  const baseDateTo = params.request.baseDateTo.trim();
  const pageCurrent = params.request.pageCurrent ?? 1;
  const pageSize = params.request.pageSize ?? 26;

  if (prodCode.length > 1000) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "PROD_CD는 최대 1000자입니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (custCode.length > 1000) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "CUST_CD는 최대 1000자입니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!/^\d{8}$/.test(baseDateFrom) || !/^\d{8}$/.test(baseDateTo)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "BASE_DATE_FROM, BASE_DATE_TO는 YYYYMMDD 형식(8자리 숫자)이어야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const fromDate = new Date(
    Number(baseDateFrom.slice(0, 4)),
    Number(baseDateFrom.slice(4, 6)) - 1,
    Number(baseDateFrom.slice(6, 8))
  );
  const toDate = new Date(
    Number(baseDateTo.slice(0, 4)),
    Number(baseDateTo.slice(4, 6)) - 1,
    Number(baseDateTo.slice(6, 8))
  );
  const spanDays = Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
  if (!Number.isFinite(spanDays) || spanDays < 0) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "BASE_DATE_FROM은 BASE_DATE_TO보다 이후일 수 없습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }
  if (spanDays > 30) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "조회 기간은 최대 30일까지 허용됩니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!Number.isInteger(pageCurrent) || pageCurrent < 1) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "PAGE_CURRENT는 1 이상의 정수여야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "PAGE_SIZE는 1~100 사이 정수여야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const handshake = await runEcountZoneLoginHandshake({
    requestId: params.requestId,
    startedAt,
    timeoutMs,
    runtimeConfig,
  });
  if (!handshake.ok) {
    await saveApiLog({ ok: false, meta: handshake.response.meta, appId, message: handshake.response.message });
    return handshake.response as ApiResponse<EcountPurchasesOrderListResponseData>;
  }

  const apiHost =
    runtimeConfig.envMode === "test"
      ? `https://sboapi${handshake.data.zone}.ecount.com`
      : `https://oapi${handshake.data.zone}.ecount.com`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${apiHost}/OAPI/V2/Purchases/GetPurchasesOrderList?SESSION_ID=${encodeURIComponent(
      handshake.data.sessionId
    )}`;
    const body: {
      PROD_CD?: string;
      CUST_CD?: string;
      ListParam: {
        PAGE_CURRENT: number;
        PAGE_SIZE: number;
        BASE_DATE_FROM: string;
        BASE_DATE_TO: string;
      };
    } = {
      ListParam: {
        PAGE_CURRENT: pageCurrent,
        PAGE_SIZE: pageSize,
        BASE_DATE_FROM: baseDateFrom,
        BASE_DATE_TO: baseDateTo,
      },
    };
    if (prodCode) {
      body.PROD_CD = prodCode;
    }
    if (custCode) {
      body.CUST_CD = custCode;
    }

    const orderRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!orderRes.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: orderRes.status,
        message: `eCount 발주서조회 API 호출 실패 (HTTP ${orderRes.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const orderBody = (await orderRes.json()) as EcountGetPurchasesOrderListApiResponse;
    const orderStatus = normalizeStatusCode(orderBody.Status);
    const orderStatusOk = orderStatus === "200";
    const rows = parseEcountResultArray(orderBody.Data?.Result);

    if (orderBody.Error || !orderStatusOk) {
      const message = buildApiFailureMessage({
        apiName: "GetPurchasesOrderList",
        status: orderStatus ?? undefined,
        error: orderBody.Error,
        defaultMessage: "eCount 발주서조회에 실패했습니다.",
        checks: [
          { label: "Status=200", ok: orderStatusOk, value: orderStatus },
          { label: "Error=null", ok: !orderBody.Error },
          { label: "ResultCount", ok: true, value: String(rows.length) },
          { label: "FROM", ok: true, value: baseDateFrom },
          { label: "TO", ok: true, value: baseDateTo },
        ],
      });
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: ApiErrorCategory.AUTH_ERROR,
        message,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const rawTotal = orderBody.Data?.TotalCnt;
    const totalCount =
      typeof rawTotal === "number"
        ? rawTotal
        : typeof rawTotal === "string" && rawTotal.trim().length > 0
          ? Number(rawTotal)
          : rows.length;

    const response = buildSuccess<EcountPurchasesOrderListResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      data: {
        comCode: runtimeConfig.comCode,
        userId: runtimeConfig.userId,
        zone: handshake.data.zone,
        domain: handshake.data.domain,
        sessionId: handshake.data.sessionId,
        traceId: orderBody.Data?.TRACE_ID ?? null,
        quantityInfo: orderBody.Data?.QUANTITY_INFO ?? null,
        totalCount: Number.isFinite(totalCount) ? totalCount : rows.length,
        orders: rows,
      },
      message: `eCount 발주서조회 성공 (${rows.length}건)`,
      extra: {
        envMode: runtimeConfig.envMode,
        prodCode: prodCode || null,
        custCode: custCode || null,
        baseDateFrom,
        baseDateTo,
        pageCurrent,
        pageSize,
      },
    });
    await saveApiLog({ ok: true, meta: response.meta, appId, message: response.message });
    return response;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
      message: isTimeout
        ? `eCount 발주서조회 시간 초과 (${timeoutMs}ms)`
        : error instanceof Error
          ? error.message
          : "eCount 발주서조회 중 네트워크 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  } finally {
    clearTimeout(timer);
  }
}
