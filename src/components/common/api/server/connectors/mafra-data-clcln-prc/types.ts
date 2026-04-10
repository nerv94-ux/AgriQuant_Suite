export type MafraDataClclnPrcRequest = {
  saleDate: string;
  whsalcd?: string;
  cmpcd?: string;
  whsalName?: string;
  cmpName?: string;
  /** 정산 가격 정보와 동일 — OpenAPI 쿼리에 LARGE/MID/SMALL 전달 */
  large?: string;
  mid?: string;
  small?: string;
  itemName?: string;
  preferGarakItemCode?: boolean;
  /** 데스크 품목명 매칭(`pickItemCandidatesForDesk`) — 기본 false(관리자 등) */
  deskItemMatch?: boolean;
  /**
   * true면 품목 코드로 조회·응답 행을 한 번 더 거름. false면 기존처럼 일자·시장(·법인)만.
   */
  filterByProductCodes?: boolean;
  /**
   * true이고 LARGE·MID·SMALL이 모두 넘어오면 품목은 코드사전으로 다시 해석하지 않고 **요청 값 그대로** 쓴다(데스크 저장 품목과 정산 탭 일치).
   */
  preferSavedItemCodes?: boolean;
  /** true면 대·중 일치 실패 시 소분류(SMALL/MMCD)만 맞춘 행도 포함(과포함 가능) */
  looseSmallMatch?: boolean;
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
    large: string | null;
    mid: string | null;
    small: string | null;
  };
  /** 어떤 정책으로 품목을 맞췄는지(디버그·UI) */
  matchPolicy?: string;
  /** 원천 품목 필터 탈락 원인 카운트(디버그·원인분석용) */
  matchDiagnostics?: {
    sourceRows: number;
    smallMatched: number;
    codebookMatched: number;
    keywordMatched: number;
    strictMatched: number;
    missingLarge: number;
    largeMismatch: number;
    missingMid: number;
    midMismatch: number;
    codebookApplied: boolean;
    keywordApplied: boolean;
    looseApplied: boolean;
  };
};
