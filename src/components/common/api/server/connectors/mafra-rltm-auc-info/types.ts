export type MafraRealtimeAuctionRequest = {
  saleDate: string;
  whsalcd?: string;
  cmpcd?: string;
  large?: string;
  mid?: string;
  small?: string;
  startIndex?: number;
  endIndex?: number;
  whsalName?: string;
  cmpName?: string;
  itemName?: string;
  autoResolveCodes?: boolean;
  preferGarakItemCode?: boolean;
};

export type MafraRealtimeAuctionItem = {
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
  SANCD: string;
  SANNAME: string;
  COST: string;
  QTY: string;
  STD: string;
  SBIDTIME: string;
};

export type MafraRealtimeAuctionResponseData = {
  totalCount: number;
  startIndex: number;
  endIndex: number;
  rows: MafraRealtimeAuctionItem[];
  resolved: {
    whsalcd: string | null;
    cmpcd: string | null;
    small: string | null;
  };
};
