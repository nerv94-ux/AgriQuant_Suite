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

/** 전체 단위 목록(데스크 선택 UI용) */
export type MafraUnitCodeListResponseData = {
  updatedAt: string | null;
  total: number;
  items: MafraUnitCode[];
};
