export type EcountHealthResponseData = {
  comCode: string;
  userId: string;
  zone: string;
  domain: string;
  sessionId: string;
};

export type EcountProductSingleRequest = {
  prodCode: string;
  prodType?: string;
};

export type EcountProductSingleResponseData = {
  comCode: string;
  userId: string;
  zone: string;
  domain: string;
  sessionId: string;
  traceId: string | null;
  quantityInfo: unknown;
  product: Record<string, unknown>;
};

/** GetBasicProductsList — 복수 품목코드·범위·유형 필터 (단건 ViewBasicProduct 와 엔드포인트·파라미터 상이) */
export type EcountProductListRequest = {
  prodCode?: string;
  commaFlag?: "Y" | "N";
  prodType?: string;
  fromProdCd?: string;
  toProdCd?: string;
};

export type EcountProductListResponseData = {
  comCode: string;
  userId: string;
  zone: string;
  domain: string;
  sessionId: string;
  traceId: string | null;
  quantityInfo: unknown;
  products: Record<string, unknown>[];
};

export type EcountInventoryBalanceRequest = {
  baseDate: string;
  prodCode: string;
  whCd?: string;
  zeroFlag?: "Y" | "N";
  balFlag?: "Y" | "N";
  delGubun?: "Y" | "N";
  safeFlag?: "Y" | "N";
};

export type EcountInventoryBalanceListRequest = {
  baseDate: string;
  prodCode?: string;
  whCd?: string;
  zeroFlag?: "Y" | "N";
  balFlag?: "Y" | "N";
  delGubun?: "Y" | "N";
  safeFlag?: "Y" | "N";
};

export type EcountInventoryBalanceResponseData = {
  comCode: string;
  userId: string;
  zone: string;
  domain: string;
  sessionId: string;
  traceId: string | null;
  quantityInfo: unknown;
  totalCount: number;
  items: Array<{
    prodCode: string;
    balQty: string;
    raw: Record<string, unknown>;
  }>;
};

export type EcountInventoryBalanceByLocationRequest = {
  baseDate: string;
  prodCode: string;
  whCd?: string;
  balFlag?: "Y" | "N";
  delGubun?: "Y" | "N";
  delLocationYn?: "Y" | "N";
};

export type EcountInventoryBalanceByLocationListRequest = {
  baseDate: string;
  prodCode?: string;
  whCd?: string;
  balFlag?: "Y" | "N";
  delGubun?: "Y" | "N";
  delLocationYn?: "Y" | "N";
};

export type EcountInventoryBalanceByLocationResponseData = {
  comCode: string;
  userId: string;
  zone: string;
  domain: string;
  sessionId: string;
  traceId: string | null;
  quantityInfo: unknown;
  totalCount: number;
  items: Array<{
    whCd: string;
    whDes: string;
    prodCode: string;
    prodDes: string;
    prodSizeDes: string;
    balQty: string;
    raw: Record<string, unknown>;
  }>;
};

export type EcountPurchasesOrderListRequest = {
  prodCode?: string;
  custCode?: string;
  pageCurrent?: number;
  pageSize?: number;
  baseDateFrom: string;
  baseDateTo: string;
};

export type EcountPurchasesOrderListResponseData = {
  comCode: string;
  userId: string;
  zone: string;
  domain: string;
  sessionId: string;
  traceId: string | null;
  quantityInfo: unknown;
  totalCount: number;
  orders: Record<string, unknown>[];
};

export type EcountZoneApiResponse = {
  Status?: string;
  Error?: {
    Code?: number | string;
    Message?: string;
    MessageDetail?: string;
  } | null;
  Data?: {
    ZONE?: string;
    DOMAIN?: string;
    EXPIRE_DATE?: string;
  } | null;
  Timestamp?: string | null;
};

export type EcountLoginApiResponse = {
  Status?: string;
  Error?: {
    Code?: number | string;
    Message?: string;
    MessageDetail?: string;
  } | null;
  Data?: {
    EXPIRE_DATE?: string;
    NOTICE?: string;
    Datas?: {
      COM_CODE?: string;
      USER_ID?: string;
      SESSION_ID?: string;
    };
    Message?: string;
    RedirectUrl?: string;
  } | null;
  Timestamp?: string | null;
};

export type EcountViewBasicProductApiResponse = {
  Status?: string | number;
  Errors?: unknown;
  Error?: {
    Code?: number | string;
    Message?: string;
    MessageDetail?: string;
  } | null;
  Data?: {
    EXPIRE_DATE?: string;
    QUANTITY_INFO?: unknown;
    TRACE_ID?: string;
    Result?: unknown;
  } | null;
  Timestamp?: string | null;
  RequestKey?: string | null;
  IsEnableNoL4?: boolean;
  RefreshTimestamp?: string | null;
  AsyncActionKey?: string | null;
};

export type EcountViewInventoryBalanceApiResponse = {
  Status?: string | number;
  Errors?: unknown;
  Error?: {
    Code?: number | string;
    Message?: string;
    MessageDetail?: string;
  } | null;
  Data?: {
    IsSuccess?: boolean;
    EXPIRE_DATE?: string;
    QUANTITY_INFO?: unknown;
    TRACE_ID?: string;
    TotalCnt?: number | string;
    Result?: unknown;
  } | null;
  Timestamp?: string | null;
  RequestKey?: string | null;
  IsEnableNoL4?: boolean;
  RefreshTimestamp?: string | null;
  AsyncActionKey?: string | null;
};

export type EcountGetPurchasesOrderListApiResponse = {
  Status?: string | number;
  Errors?: unknown;
  Error?: {
    Code?: number | string;
    Message?: string;
    MessageDetail?: string;
  } | null;
  Data?: {
    EXPIRE_DATE?: string;
    QUANTITY_INFO?: unknown;
    TRACE_ID?: string;
    TotalCnt?: number | string;
    Result?: unknown;
  } | null;
  Timestamp?: string | null;
  RequestKey?: string | null;
  IsEnableNoL4?: boolean;
  RefreshTimestamp?: string | null;
  AsyncActionKey?: string | null;
};
