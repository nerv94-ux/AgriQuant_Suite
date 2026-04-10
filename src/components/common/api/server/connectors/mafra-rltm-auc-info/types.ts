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
  /** 데스크 품목 시세: 코드사전 품목 매칭 시 `기타` 등 완화 */
  deskItemMatch?: boolean;
  /**
   * 데스크 전용: 응답 행을 저장 품목과 맞춤. `small`은 필수.
   * `large`/`mid`도 있으면 함께 비교 — **짧은 SMALL(예: 01)만으로는 품목이 유일하지 않을 수 있음**.
   */
  deskStrictItem?: { small: string; large?: string; mid?: string };
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
  /**
   * 저장된 대·중 품목코드까지 넣으면 0건이었을 때, 소(SMALL)만으로 한 번 더 조회해 건수를 맞춘 경우
   */
  usedRelaxedLargeMid?: boolean;
  /** `deskStrictItem` 적용으로 제거한 행 수(있을 때만) */
  deskSmallFilteredCount?: number;
};
