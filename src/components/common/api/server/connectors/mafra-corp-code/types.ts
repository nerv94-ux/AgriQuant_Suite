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

/** 전체 법인 목록(데스크 선택 UI용) */
export type MafraCorpCodeListResponseData = {
  updatedAt: string | null;
  total: number;
  items: MafraCorpCode[];
};
