/** 소매가격정보·소비 트렌드 결합 (W_DI_AGRICNSMTRND) — Grid_20260128000000000689_1 */

export type MafraAgricnsmTrndRequest = {
  /** 기준연도 (선택, 명세 출력 필드 기준 쿼리 지원 시) */
  CRTR_YEAR?: string;
  /** 기준월 1~12 (선택) */
  CRTR_MONTH?: string;
  startIndex?: number;
  endIndex?: number;
};

export type MafraAgricnsmTrndItem = {
  ROW_NUM: string;
  CRTR_YEAR: string;
  CRTR_MONTH: string;
  CLSF_NM: string;
  ITEM_NM: string;
  MON_PRCHS_AMT: string;
  MON_PRCHS_NOCS: string;
  MON_PRCHS_NOCS_AMT: string;
  ESTMTN_NTSL_QTY: string;
  AVG_AMT: string;
  ESTMTN_SLS_AMT: string;
  MON_AVG_AMT: string;
  MON_AMPL_CFFCNT: string;
  MON_FLCTN_CFFCNT: string;
  MON_MAX_AMT: string;
  MON_MIN_AMT: string;
  MON_SDVTN: string;
  YEAR_AVG_AMT: string;
  YEAR_AMPL_CFFCNT: string;
  YEAR_FLCTN_CFFCNT: string;
  YEAR_MAX_AMT: string;
  YEAR_MIN_AMT: string;
  YEAR_SDVTN: string;
  REG_DT: string;
  REG_USERID: string;
  UPD_DT: string;
  UPD_USERID: string;
  /** 명세 외 확장 컬럼(예: 성별/연령/지역 세분값 등)도 보존 */
  [key: string]: string;
};

export type MafraAgricnsmTrndResponseData = {
  totalCount: number;
  startIndex: number;
  endIndex: number;
  rows: MafraAgricnsmTrndItem[];
};
