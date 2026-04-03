export type MafraUnitCode = {
  CODEID: string;
  CODENAME: string;
};

export type MafraUnitCodeSyncResponseData = {
  syncedCount: number;
  updatedAt: string;
};

export type MafraUnitCodeSearchResponseData = {
  query: string;
  updatedAt: string | null;
  totalCached: number;
  matches: MafraUnitCode[];
};
