/** 도매시장 동시 조회 상한(기본값) — 서버 `fetchDeskAuctionPriceSheet`와 동일 */
export const DESK_AUCTION_DEFAULT_MAX_MARKETS = 45;

/** 시장당 한 번에 가져오는 경매 행 상한(실시간 경매 API 요청 범위) */
export const DESK_AUCTION_MAX_ROWS_PER_MARKET = 1000;

/** 시장별 상세 경매 행(API가 준 만큼 — 한 번에 최대 1000건) */
export type DeskAuctionPriceSheetDetailRow = {
  cost: string;
  qty: string;
  std: string;
  sbidtime: string;
  cmpName: string;
  /** API 응답 SMALL(소분류 코드) — 행마다 동일해야 정상 */
  smallCode: string;
  smallName: string;
  midName: string;
  sanName: string;
};

/** GET `/api/desk/auction-prices` 응답 본문(성공 시 `data`) */
export type DeskAuctionPriceSheetMarketRow = {
  whsalcd: string;
  /** 코드사전 도매시장명 */
  marketName: string;
  /** API 첫 행의 WHSALNAME(있으면) */
  apiWhsalName: string | null;
  /** API totalCnt(있으면, 샘플보다 많을 수 있음) */
  apiTotalCount: number | null;
  rowCount: number;
  avgCost: number | null;
  minCost: number | null;
  maxCost: number | null;
  /** 첫 건 낙찰가(대표값) */
  firstCost: number | null;
  /** 표에서 가락을 강조하기 위한 플래그 */
  isGarak: boolean;
  /** 해당 시장 조회 실패 시 메시지 */
  error?: string;
  /** 조회에 포함된 전체 경매 행(에러 시 없음) */
  detailRows: DeskAuctionPriceSheetDetailRow[];
};

export type DeskAuctionPriceSheetData = {
  productId: string;
  productName: string;
  /** 표시용 규격(저장값) */
  specLabel: string;
  packageUnit: string;
  saleDate: string;
  mafraLarge: string | null;
  mafraMid: string | null;
  mafraSmall: string;
  /** DB 저장 등급 코드 — 실시간 경매 API에는 넣지 않음(품목만 조회). 혼동 방지용 표시 */
  mafraGrdCodeId: string | null;
  /** DB에 소(SMALL)가 없어 코드사전으로만 맞춘 경우 */
  smallResolvedFromCodebook: boolean;
  /** `smallResolvedFromCodebook`과 동일 의미의 명시적 출처 */
  itemResolutionSource: "db" | "codebook";
  /** 코드사전 자동 매칭에 성공한 검색 문장(디버깅·확인용) */
  codebookMatchedQuery: string | null;
  /** 코드사전에 맞춘 품목 표준명(있으면) */
  codebookMatchedItemName: string | null;
  /** 이름-품목명 교차검증을 건너뛰고 코드만 맞춘 경우(데이터는 나오나 확인 권장) */
  codebookPlausibilitySkipped: boolean;
  marketsInCache: number;
  marketsQueried: number;
  /** 상한(도매시장 수 × API 호출 부담 완화) */
  maxMarketsCap: number;
  /** 한 시장당 조회한 최대 행 수(통계는 이 샘플 기준) */
  rowsSampledPerMarket: number;
  /** 도매시장코드 캐시 갱신 시각 */
  marketCodesUpdatedAt: string | null;
  markets: DeskAuctionPriceSheetMarketRow[];
};
