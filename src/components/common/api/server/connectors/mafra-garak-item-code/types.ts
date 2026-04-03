export type MafraGarakItemCode = {
  STAN_CODE: string;
  SCLASSCODE: string;
  GARRAK_CODE: string;
  GARRAK_NAME: string;
};

export type SearchMafraGarakItemCodeRequest = {
  garrakName?: string;
  stanCode?: string;
  sclassCode?: string;
  garrakCode?: string;
  startIndex?: number;
  endIndex?: number;
};

export type MafraGarakItemCodeSearchResponseData = {
  totalCount: number;
  rows: MafraGarakItemCode[];
};
