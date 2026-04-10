export type MafraMarketCode = {
  CODEID: string;
  CODENAME: string;
};

export type MafraMarketCodeSyncResponseData = {
  syncedCount: number;
  updatedAt: string;
};

export type MafraMarketCodeSearchResponseData = {
  query: string;
  updatedAt: string | null;
  totalCached: number;
  matches: MafraMarketCode[];
};

/** 전체 도매시장 목록(데스크 선택 UI용) */
export type MafraMarketCodeListResponseData = {
  updatedAt: string | null;
  total: number;
  items: MafraMarketCode[];
};
