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
