export type MafraClclnPrcWhlslMrktRequest = {
  registDt: string;
  whsalcd?: string;
  whsalName?: string;
  autoResolveCodes?: boolean;
  startIndex?: number;
  endIndex?: number;
};

export type MafraClclnPrcWhlslMrktItem = {
  WHSALCD: string;
  WHSALNAME: string;
  TOTQTY: string;
  TOTAMT: string;
  REGIST_DT: string;
};

export type MafraClclnPrcWhlslMrktResponseData = {
  totalCount: number;
  startIndex: number;
  endIndex: number;
  rows: MafraClclnPrcWhlslMrktItem[];
  resolved: {
    whsalcd: string | null;
  };
};
