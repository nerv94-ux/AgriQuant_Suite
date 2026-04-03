export type MafraDataClclnPrcRequest = {
  saleDate: string;
  whsalcd?: string;
  cmpcd?: string;
  whsalName?: string;
  cmpName?: string;
  autoResolveCodes?: boolean;
  startIndex?: number;
  endIndex?: number;
};

export type MafraDataClclnPrcItem = {
  SALEDATE: string;
  WHSALCD: string;
  CMPCD: string;
  SEQ: string;
  NO1: string;
  NO2: string;
  MEJANG: string;
  MMCD: string;
  LARGE: string;
  MID: string;
  SMALL: string;
  CMPGOOD: string;
  PUMNAME: string;
  GOODNAME: string;
  DANQ: string;
  DANCD: string;
  POJCD: string;
  SIZECD: string;
  LVCD: string;
  QTY: string;
  COST: string;
  AMERCD: string;
  SANCD: string;
  CMPSAN: string;
  SANNAME: string;
  CHCD: string;
  SMANCD: string;
  CHULNO: string;
  CHULCD: string;
  CHULNAME: string;
  FARMNAME: string;
  TOTQTY: string;
  TOTAMT: string;
  SBIDTIME: string;
};

export type MafraDataClclnPrcResponseData = {
  totalCount: number;
  startIndex: number;
  endIndex: number;
  rows: MafraDataClclnPrcItem[];
  resolved: {
    whsalcd: string | null;
    cmpcd: string | null;
  };
};
