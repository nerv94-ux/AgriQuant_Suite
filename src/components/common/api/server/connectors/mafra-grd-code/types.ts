export type MafraGrdCode = {
  CODEID: string;
  CODENAME: string;
};

export type MafraGrdCodeSyncResponseData = {
  syncedCount: number;
  updatedAt: string;
};

export type MafraGrdCodeSearchResponseData = {
  query: string;
  updatedAt: string | null;
  totalCached: number;
  matches: MafraGrdCode[];
};
