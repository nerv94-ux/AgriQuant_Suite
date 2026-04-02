import { createApiClient, ApiError } from "../http";
import type {
  EcountInventoryBalanceByLocationResponseData,
  EcountInventoryBalanceResponseData,
  EcountProductListResponseData,
  EcountProductSingleResponseData,
  EcountPurchasesOrderListResponseData,
  GeminiResponseData,
  KmaForecastResponseData,
  KmaWarningResponseData,
} from "../index";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T | null;
  message?: string;
};

type AiChatRequest = {
  prompt: string;
  context?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

type EcountProductGetRequest = {
  prodCode: string;
  prodType?: string;
};

type EcountProductListRequest = {
  prodCode?: string;
  commaFlag?: "Y" | "N";
  prodType?: string;
  fromProdCd?: string;
  toProdCd?: string;
};

type EcountInventoryRequest = {
  baseDate: string;
  prodCode: string;
  whCd?: string;
  zeroFlag?: "Y" | "N";
  balFlag?: "Y" | "N";
  delGubun?: "Y" | "N";
  safeFlag?: "Y" | "N";
};

type EcountInventoryListRequest = {
  baseDate: string;
  prodCode?: string;
  whCd?: string;
  zeroFlag?: "Y" | "N";
  balFlag?: "Y" | "N";
  delGubun?: "Y" | "N";
  safeFlag?: "Y" | "N";
};

type EcountInventoryByLocationRequest = {
  baseDate: string;
  prodCode: string;
  whCd?: string;
  balFlag?: "Y" | "N";
  delGubun?: "Y" | "N";
  delLocationYn?: "Y" | "N";
};

type EcountInventoryByLocationListRequest = {
  baseDate: string;
  prodCode?: string;
  whCd?: string;
  balFlag?: "Y" | "N";
  delGubun?: "Y" | "N";
  delLocationYn?: "Y" | "N";
};

type EcountPurchasesOrderListRequest = {
  prodCode?: string;
  custCode?: string;
  pageCurrent?: number;
  pageSize?: number;
  baseDateFrom: string;
  baseDateTo: string;
};

type WeatherWarningRequest = {
  stnId?: string;
  fromTm?: string;
  toTm?: string;
};

type WeatherForecastRequest = {
  baseDate?: string;
  baseTime?: string;
  nx?: number;
  ny?: number;
  pageNo?: number;
  numOfRows?: number;
};

const client = createApiClient();

function unwrapEnvelope<T>(payload: ApiEnvelope<T>): T {
  if (!payload.ok || !payload.data) {
    throw new ApiError(payload.message ?? "요청 처리에 실패했습니다.", 200, payload);
  }
  return payload.data;
}

export const mainApi = {
  ai: {
    chat: async (request: AiChatRequest): Promise<GeminiResponseData> => {
      const payload = await client.post<ApiEnvelope<GeminiResponseData>, AiChatRequest>("/api/ai/chat", request);
      return unwrapEnvelope(payload);
    },
  },
  erp: {
    products: {
      get: async (request: EcountProductGetRequest): Promise<EcountProductSingleResponseData> => {
        const payload = await client.post<
          ApiEnvelope<EcountProductSingleResponseData>,
          EcountProductGetRequest
        >("/api/erp/products/get", request);
        return unwrapEnvelope(payload);
      },
      list: async (request: EcountProductListRequest): Promise<EcountProductListResponseData> => {
        const payload = await client.post<
          ApiEnvelope<EcountProductListResponseData>,
          EcountProductListRequest
        >("/api/erp/products/list", request);
        return unwrapEnvelope(payload);
      },
    },
    inventory: {
      get: async (request: EcountInventoryRequest): Promise<EcountInventoryBalanceResponseData> => {
        const payload = await client.post<
          ApiEnvelope<EcountInventoryBalanceResponseData>,
          EcountInventoryRequest
        >("/api/erp/inventory/get", request);
        return unwrapEnvelope(payload);
      },
      list: async (request: EcountInventoryListRequest): Promise<EcountInventoryBalanceResponseData> => {
        const payload = await client.post<
          ApiEnvelope<EcountInventoryBalanceResponseData>,
          EcountInventoryListRequest
        >("/api/erp/inventory/list", request);
        return unwrapEnvelope(payload);
      },
      byLocation: {
        get: async (
          request: EcountInventoryByLocationRequest
        ): Promise<EcountInventoryBalanceByLocationResponseData> => {
          const payload = await client.post<
            ApiEnvelope<EcountInventoryBalanceByLocationResponseData>,
            EcountInventoryByLocationRequest
          >("/api/erp/inventory/by-location/get", request);
          return unwrapEnvelope(payload);
        },
        list: async (
          request: EcountInventoryByLocationListRequest
        ): Promise<EcountInventoryBalanceByLocationResponseData> => {
          const payload = await client.post<
            ApiEnvelope<EcountInventoryBalanceByLocationResponseData>,
            EcountInventoryByLocationListRequest
          >("/api/erp/inventory/by-location/list", request);
          return unwrapEnvelope(payload);
        },
      },
    },
    purchases: {
      orders: {
        list: async (
          request: EcountPurchasesOrderListRequest
        ): Promise<EcountPurchasesOrderListResponseData> => {
          const payload = await client.post<
            ApiEnvelope<EcountPurchasesOrderListResponseData>,
            EcountPurchasesOrderListRequest
          >("/api/erp/purchases/orders/list", request);
          return unwrapEnvelope(payload);
        },
      },
    },
  },
  weather: {
    warning: async (request: WeatherWarningRequest = {}): Promise<KmaWarningResponseData> => {
      const payload = await client.post<ApiEnvelope<KmaWarningResponseData>, WeatherWarningRequest>(
        "/api/weather/warning",
        request
      );
      return unwrapEnvelope(payload);
    },
    forecast: async (request: WeatherForecastRequest = {}): Promise<KmaForecastResponseData> => {
      const payload = await client.post<ApiEnvelope<KmaForecastResponseData>, WeatherForecastRequest>(
        "/api/weather/forecast",
        request
      );
      return unwrapEnvelope(payload);
    },
  },
};

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
};
