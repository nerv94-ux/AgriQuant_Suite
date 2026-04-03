export type MafraFrmlCode = {
  CODEID: string;
  CODENAME: string;
};

export type MafraFrmlCodeSyncResponseData = {
  syncedCount: number;
  updatedAt: string;
};

export type MafraFrmlCodeSearchResponseData = {
  query: string;
  updatedAt: string | null;
  totalCached: number;
  matches: MafraFrmlCode[];
};
