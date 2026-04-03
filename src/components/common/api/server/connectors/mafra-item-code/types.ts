export type MafraItemCode = {
  LARGE: string;
  MID: string;
  SMALL: string;
  LARGENAME: string;
  MIDNAME: string;
  GOODNAME: string;
  GUBN: string;
};

export type MafraItemCodeSyncResponseData = {
  syncedCount: number;
  updatedAt: string;
};

export type MafraItemCodeSearchResponseData = {
  query: string;
  updatedAt: string | null;
  totalCached: number;
  matches: MafraItemCode[];
};
