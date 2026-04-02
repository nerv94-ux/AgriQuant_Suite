// Client-safe HTTP 유틸
export { createApiClient, ApiError } from "./http";
export type { ApiMethod, ApiRequestOptions, ApiClientConfig } from "./http";
export { mainApi } from "./client";
export {
  useAiChat,
  useErpInventoryByLocationGet,
  useErpInventoryByLocationList,
  useErpInventoryGet,
  useErpInventoryList,
  useErpProductGet,
  useErpProductList,
  useErpPurchasesOrdersList,
  useWeatherForecast,
  useWeatherWarning,
} from "./client";
export type {
  AiChatRequest,
  EcountInventoryByLocationListRequest,
  EcountInventoryByLocationRequest,
  EcountInventoryListRequest,
  EcountInventoryRequest,
  EcountProductGetRequest,
  EcountProductListRequest,
  EcountPurchasesOrderListRequest,
  WeatherForecastRequest,
  WeatherWarningRequest,
} from "./client";

// Admin UI
export { ApiConnectorsPanel } from "./admin/ApiConnectorsPanel";

// ─── Server-only (Next.js API Route / Server Action 전용) ────────
// 클라이언트에서 직접 import하지 말 것 — API 키 노출 위험
export type { BaseMeta, BaseMetaSource, ApiResponse } from "./server/contracts";
export { ApiErrorCategory, classifyHttpStatus } from "./server/contracts";
export { buildSuccess, buildError } from "./server/helpers/buildResponse";
export { saveApiLog } from "./server/logging/saveApiLog";
export { callGemini } from "./server/connectors/gemini";
export { callKmaHealthCheck, callKmaShortForecast, callKmaWeatherWarning } from "./server/connectors/kma";
export { callEcoPriceHealthCheck, callEcoPriceProductList } from "./server/connectors/eco-price";
export {
  callEcountConnectionCheck,
  callEcountGetPurchasesOrderList,
  callEcountGetListInventoryBalanceStatusByLocation,
  callEcountGetListInventoryBalanceStatus,
  callEcountGetBasicProductsList,
  callEcountViewBasicProduct,
  callEcountViewInventoryBalanceStatus,
  callEcountViewInventoryBalanceStatusByLocation,
} from "./server/connectors/ecount";
export type {
  GeminiRequest,
  GeminiResponseData,
  GeminiContent,
  GeminiGenerationConfig,
} from "./server/connectors/gemini";
export type { KmaForecastResponseData, KmaHealthResponseData, KmaWarningResponseData } from "./server/connectors/kma";
export type { EcoPriceProductListRequest, EcoPriceProductListResponseData } from "./server/connectors/eco-price";
export type {
  EcountHealthResponseData,
  EcountInventoryBalanceByLocationResponseData,
  EcountInventoryBalanceResponseData,
  EcountPurchasesOrderListResponseData,
  EcountProductListResponseData,
  EcountProductSingleResponseData,
} from "./server/connectors/ecount";

