export type EcoPriceProductListRequest = {
  pageNo?: number;
  numOfRows?: number;
  fromDate: string;
  toDate: string;
  ctgryCd?: string;
  itemCd?: string;
  vrtyCd?: string;
  grdCd?: string;
  sggCd?: string;
  mrktCd?: string;
};

export type EcoPriceItem = Record<string, unknown>;

export type EcoPriceProductListResponseData = {
  totalCount: number;
  items: EcoPriceItem[];
};

type HeaderShape = {
  resultCode?: string;
  resultMsg?: string;
};

type BodyShape = {
  totalCount?: number | string;
  items?:
    | {
        item?: unknown[] | unknown;
      }
    | unknown[] 
    | unknown;
};

export type EcoPriceApiRawResponse = {
  response?: {
    header?: HeaderShape;
    body?: BodyShape;
  };
  header?: HeaderShape;
  body?: BodyShape;
  resultCode?: string;
  resultMsg?: string;
  totalCount?: number | string;
  data?: unknown[] | unknown;
};
