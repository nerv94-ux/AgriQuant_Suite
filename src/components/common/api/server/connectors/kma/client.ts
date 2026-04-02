import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { getKmaRuntimeConfig } from "../../admin/providerSettings";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import type {
  KmaForecastRequest,
  KmaForecastResponseData,
  KmaHealthResponseData,
  KmaWarningRequest,
  KmaWarningResponseData,
} from "./types";

const SOURCE = "KMA" as const;
const BASE_URL = "https://apis.data.go.kr/1360000";
const DEFAULT_TIMEOUT_MS = 10_000;

type KmaResponseBody = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      totalCount?: number;
      items?: {
        item?: unknown[] | unknown;
      };
    };
  };
};

type KmaParamsBase = {
  requestId: string;
  appId?: string;
  timeoutMs?: number;
};

type CallKmaWarningParams = KmaParamsBase & {
  request: KmaWarningRequest;
};

type CallKmaShortForecastParams = KmaParamsBase & {
  request: KmaForecastRequest;
};

type CallKmaHealthCheckParams = KmaParamsBase;

function normalizeKmaItems(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    );
  }
  if (value && typeof value === "object") {
    return [value as Record<string, unknown>];
  }
  return [];
}

function normalizeDate(date: Date): string {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function todayBaseDate() {
  return normalizeDate(new Date());
}

async function callKmaEndpoint(params: {
  requestId: string;
  startedAt: number;
  path: string;
  query: Record<string, string>;
  timeoutMs: number;
  allowNoData?: boolean;
}) {
  const runtimeConfig = await getKmaRuntimeConfig();
  if (!runtimeConfig.enabled) {
    return {
      ok: false as const,
      response: buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt: params.startedAt,
        errorCategory: ApiErrorCategory.DISABLED,
        message: "기상청 커넥터가 관리자 설정에서 비활성화되어 있습니다.",
      }),
    };
  }

  if (!runtimeConfig.serviceKey) {
    return {
      ok: false as const,
      response: buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt: params.startedAt,
        errorCategory: ApiErrorCategory.AUTH_ERROR,
        message: "기상청 Service Key가 설정되지 않았습니다.",
      }),
    };
  }

  const search = new URLSearchParams({
    serviceKey: runtimeConfig.serviceKey,
    dataType: "JSON",
    ...params.query,
  });
  const url = `${BASE_URL}${params.path}?${search.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    if (!res.ok) {
      return {
        ok: false as const,
        response: buildError({
          source: SOURCE,
          requestId: params.requestId,
          startedAt: params.startedAt,
          httpStatus: res.status,
          message: `기상청 API 호출 실패 (HTTP ${res.status})`,
        }),
      };
    }

    const body = (await res.json()) as KmaResponseBody;
    const resultCode = body.response?.header?.resultCode ?? "";
    if (resultCode !== "00") {
      if (params.allowNoData && resultCode === "03") {
        return {
          ok: true as const,
          totalCount: 0,
          items: [] as Record<string, unknown>[],
          runtimeConfig,
        };
      }
      const resultMsg = body.response?.header?.resultMsg ?? "기상청 API 오류";
      return {
        ok: false as const,
        response: buildError({
          source: SOURCE,
          requestId: params.requestId,
          startedAt: params.startedAt,
          errorCategory: ApiErrorCategory.AUTH_ERROR,
          message: `KMA(${resultCode}) ${resultMsg}`,
        }),
      };
    }

    const totalCountRaw = body.response?.body?.totalCount ?? 0;
    const totalCount = typeof totalCountRaw === "number" ? totalCountRaw : Number(totalCountRaw);
    const items = normalizeKmaItems(body.response?.body?.items?.item);
    return {
      ok: true as const,
      totalCount: Number.isFinite(totalCount) ? totalCount : items.length,
      items,
      runtimeConfig,
    };
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false as const,
      response: buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt: params.startedAt,
        errorCategory: isTimeout ? ApiErrorCategory.TIMEOUT : ApiErrorCategory.NETWORK_ERROR,
        message: isTimeout
          ? `기상청 API 요청 시간 초과 (${params.timeoutMs}ms)`
          : error instanceof Error
            ? error.message
            : "기상청 API 호출 중 네트워크 오류가 발생했습니다.",
      }),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function callKmaWeatherWarning(
  params: CallKmaWarningParams
): Promise<ApiResponse<KmaWarningResponseData>> {
  const startedAt = performance.now();
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = await callKmaEndpoint({
    requestId: params.requestId,
    startedAt,
    timeoutMs,
    path: "/WthrWrnInfoService/getWthrWrnList",
    allowNoData: true,
    query: {
      numOfRows: "50",
      pageNo: "1",
      ...(params.request.stnId ? { stnId: params.request.stnId } : {}),
      ...(params.request.fromTm ? { fromTm: params.request.fromTm } : {}),
      ...(params.request.toTm ? { toTm: params.request.toTm } : {}),
    },
  });

  if (!endpoint.ok) {
    await saveApiLog({
      ok: false,
      meta: endpoint.response.meta,
      appId: params.appId,
      message: endpoint.response.message,
    });
    return endpoint.response as ApiResponse<KmaWarningResponseData>;
  }

  const response = buildSuccess<KmaWarningResponseData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    data: {
      totalCount: endpoint.totalCount,
      items: endpoint.items,
    },
    message: `기상특보 조회 성공 (${endpoint.items.length}건)`,
    extra: {
      stnId: params.request.stnId ?? null,
      fromTm: params.request.fromTm ?? null,
      toTm: params.request.toTm ?? null,
    },
  });
  await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
  return response;
}

export async function callKmaShortForecast(
  params: CallKmaShortForecastParams
): Promise<ApiResponse<KmaForecastResponseData>> {
  const startedAt = performance.now();
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const endpoint = await callKmaEndpoint({
    requestId: params.requestId,
    startedAt,
    timeoutMs,
    path: "/VilageFcstInfoService_2.0/getVilageFcst",
    query: {
      pageNo: String(params.request.pageNo ?? 1),
      numOfRows: String(params.request.numOfRows ?? 50),
      base_date: params.request.baseDate,
      base_time: params.request.baseTime,
      nx: String(params.request.nx),
      ny: String(params.request.ny),
    },
  });

  if (!endpoint.ok) {
    await saveApiLog({
      ok: false,
      meta: endpoint.response.meta,
      appId: params.appId,
      message: endpoint.response.message,
    });
    return endpoint.response as ApiResponse<KmaForecastResponseData>;
  }

  const response = buildSuccess<KmaForecastResponseData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    data: {
      totalCount: endpoint.totalCount,
      items: endpoint.items,
    },
    message: `단기예보 조회 성공 (${endpoint.items.length}건)`,
    extra: {
      nx: params.request.nx,
      ny: params.request.ny,
      baseDate: params.request.baseDate,
      baseTime: params.request.baseTime,
    },
  });
  await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
  return response;
}

export async function callKmaHealthCheck(
  params: CallKmaHealthCheckParams
): Promise<ApiResponse<KmaHealthResponseData>> {
  const startedAt = performance.now();
  const runtimeConfig = await getKmaRuntimeConfig();
  const baseDate = todayBaseDate();
  const baseTime = runtimeConfig.baseTime;

  const [warningRes, forecastRes] = await Promise.all([
    callKmaWeatherWarning({
      requestId: params.requestId,
      timeoutMs: params.timeoutMs,
      appId: params.appId,
      request: {},
    }),
    callKmaShortForecast({
      requestId: `${params.requestId}-fcst`,
      timeoutMs: params.timeoutMs,
      appId: params.appId,
      request: {
        baseDate,
        baseTime,
        nx: runtimeConfig.nx,
        ny: runtimeConfig.ny,
        pageNo: runtimeConfig.pageNo,
        numOfRows: runtimeConfig.numOfRows,
      },
    }),
  ]);

  if (!warningRes.ok) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: `기상특보 연결 확인 실패: ${warningRes.message}`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
  if (!forecastRes.ok) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: `단기예보 연결 확인 실패: ${forecastRes.message}`,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const response = buildSuccess<KmaHealthResponseData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    data: {
      warningCount: warningRes.data.totalCount,
      forecastCount: forecastRes.data.totalCount,
      nx: runtimeConfig.nx,
      ny: runtimeConfig.ny,
      baseDate,
      baseTime,
    },
    message: "기상특보/단기예보 연결 확인에 성공했습니다.",
  });
  await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
  return response;
}
