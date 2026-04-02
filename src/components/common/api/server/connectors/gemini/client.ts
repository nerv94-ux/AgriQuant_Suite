import type { ApiResponse } from "../../contracts/response";
import { ApiErrorCategory } from "../../contracts/errors";
import { buildSuccess, buildError } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import type { GeminiRequest, GeminiResponseData, GeminiRawResponse } from "./types";
import { transformGeminiResponse } from "./transformer";
import { getGeminiRuntimeConfig } from "../../admin/providerSettings";

const SOURCE = "GEMINI" as const;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MODEL = "gemini-2.0-flash";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

type CallGeminiParams = {
  requestId: string;
  request: GeminiRequest;
  model?: string;
  timeoutMs?: number;
  appId?: string;
};

export async function callGemini(
  params: CallGeminiParams
): Promise<ApiResponse<GeminiResponseData>> {
  const { requestId, request, model, timeoutMs, appId } = params;
  const startedAt = performance.now();
  const runtimeConfig = await getGeminiRuntimeConfig();
  const apiKey = runtimeConfig.apiKey;
  const effectiveModel = model ?? runtimeConfig.defaultModel ?? DEFAULT_MODEL;
  const effectiveTimeoutMs = timeoutMs ?? runtimeConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const generationConfig = {
    ...request.generationConfig,
    temperature:
      request.generationConfig?.temperature ?? runtimeConfig.temperature ?? undefined,
    maxOutputTokens:
      request.generationConfig?.maxOutputTokens ??
      runtimeConfig.maxOutputTokens ??
      undefined,
  };
  const effectiveRequest: GeminiRequest = {
    ...request,
    generationConfig,
  };

  if (!runtimeConfig.enabled) {
    const response = buildError({
      message: "Gemini 커넥터가 관리자 설정에서 비활성화되어 있습니다.",
      source: SOURCE,
      requestId,
      startedAt,
      errorCategory: ApiErrorCategory.DISABLED,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  // API 키 확인
  if (!apiKey) {
    const response = buildError({
      message: "Gemini API 키가 설정되지 않았습니다. 관리자 화면 또는 환경 변수에서 키를 등록해 주세요.",
      source: SOURCE,
      requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
    return response;
  }

  const url = `${GEMINI_BASE_URL}/${effectiveModel}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(effectiveRequest),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      let rawBody = "";
      try {
        rawBody = await res.text();
      } catch {
        /* 무시 */
      }

      const response = buildError({
        message: `Gemini API 오류 — HTTP ${res.status}`,
        source: SOURCE,
        requestId,
        startedAt,
        httpStatus: res.status,
        extra: {
          model: effectiveModel,
          keySource: runtimeConfig.keySource,
          rawBody: rawBody.slice(0, 500),
        },
      });
      await saveApiLog({ ok: false, meta: response.meta, appId, message: response.message });
      return response;
    }

    const raw = (await res.json()) as GeminiRawResponse;
    const data = transformGeminiResponse(raw);

    const response = buildSuccess<GeminiResponseData>({
      data,
      source: SOURCE,
      requestId,
      startedAt,
      extra: {
        model: effectiveModel,
        keySource: runtimeConfig.keySource,
        totalTokens: data.usage?.totalTokens,
      },
    });

    await saveApiLog({ ok: true, meta: response.meta, appId });
    return response;
  } catch (err: unknown) {
    clearTimeout(timer);

    const isTimeout =
      err instanceof DOMException && err.name === "AbortError";
    const message = isTimeout
      ? `Gemini API 요청 시간 초과 (${effectiveTimeoutMs}ms)`
      : err instanceof Error
        ? err.message
        : "알 수 없는 네트워크 오류가 발생했습니다.";

    const errorCategory = isTimeout
      ? ApiErrorCategory.TIMEOUT
      : ApiErrorCategory.NETWORK_ERROR;

    const response = buildError({
      message,
      source: SOURCE,
      requestId,
      startedAt,
      errorCategory,
    });
    await saveApiLog({ ok: false, meta: response.meta, appId, message });
    return response;
  }
}
