export type MafraClclnPrcInfoRequest = {
  saleDate: string;
  whsalcd?: string;
  cmpcd?: string;
  large?: string;
  mid?: string;
  small?: string;
  whsalName?: string;
  cmpName?: string;
  itemName?: string;
  autoResolveCodes?: boolean;
  preferGarakItemCode?: boolean;
  startIndex?: number;
  endIndex?: number;
};

export type MafraClclnPrcInfoItem = {
  SALEDATE: string;
  WHSALCD: string;
  WHSALNAME: string;
  CMPCD: string;
  CMPNAME: string;
  LARGE: string;
  LARGENAME: string;
  MID: string;
  MIDNAME: string;
  SMALL: string;
  SMALLNAME: string;
  DANQ: string;
  DANCD: string;
  POJCD: string;
  STD: string;
  SIZECD: string;
  SIZENAME: string;
  LVCD: string;
  LVNAME: string;
  SANCD: string;
  SANNAME: string;
  TOTQTY: string;
  TOTAMT: string;
  MINAMT: string;
  MAXAMT: string;
  AVGAMT: string;
};

export type MafraClclnPrcInfoResponseData = {
  totalCount: number;
  startIndex: number;
  endIndex: number;
  rows: MafraClclnPrcInfoItem[];
  resolved: {
    whsalcd: string | null;
    cmpcd: string | null;
    small: string | null;
  };
};
