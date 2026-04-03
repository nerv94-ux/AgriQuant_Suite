export type MafraCorpCode = {
  CODEID: string;
  CODENAME: string;
};

export type MafraCorpCodeSyncResponseData = {
  syncedCount: number;
  updatedAt: string;
};

export type MafraCorpCodeSearchResponseData = {
  query: string;
  updatedAt: string | null;
  totalCached: number;
  matches: MafraCorpCode[];
};
