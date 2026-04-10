/** 농수축산물 소매가격 OpenAPI — 명세: Grid_20141225000000000163_1 */

export type MafraRetailSalPriceRequest = {
  /** 조사일자 YYYYMMDD (필수) */
  examinDe: string;
  FRMPRD_CATGORY_CD?: string;
  PRDLST_CD?: string;
  SPCIES_CD?: string;
  GRAD_CD?: string;
  AREA_CD?: string;
  MRKT_CD?: string;
  startIndex?: number;
  endIndex?: number;
};

export type MafraRetailSalPriceItem = {
  ROW_NUM: string;
  EXAMIN_DE: string;
  FRMPRD_CATGORY_NM: string;
  FRMPRD_CATGORY_CD: string;
  PRDLST_CD: string;
  PRDLST_NM: string;
  SPCIES_CD: string;
  SPCIES_NM: string;
  GRAD_CD: string;
  GRAD_NM: string;
  EXAMIN_UNIT: string;
  AREA_CD: string;
  AREA_NM: string;
  MRKT_CD: string;
  MRKT_NM: string;
  AMT: string;
};

export type MafraRetailSalPriceResponseData = {
  totalCount: number;
  startIndex: number;
  endIndex: number;
  rows: MafraRetailSalPriceItem[];
};
