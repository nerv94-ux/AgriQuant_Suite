export type MafraPlorCode = {
  CODEID: string;
  CODENAME: string;
};

export type MafraPlorCodeSyncResponseData = {
  syncedCount: number;
  updatedAt: string;
};

export type MafraPlorCodeSearchResponseData = {
  query: string;
  updatedAt: string | null;
  totalCached: number;
  matches: MafraPlorCode[];
};
