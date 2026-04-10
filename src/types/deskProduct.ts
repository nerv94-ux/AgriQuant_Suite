export type DeskProductSource = "ecount" | "manual";

export type DeskProduct = {
  id: string;
  /** 이카운트 동기화 시 품목코드 */
  ecountProdCode?: string | null;
  /** 품목코드에서 첫 `*` 앞(표시용) */
  ecountCodeBase?: string | null;
  /** 품목코드에서 첫 `*` 뒤 구분(표시용) */
  ecountCodeSuffix?: string | null;
  /** 품목명을 `*` 기준으로 나눈 세그먼트(표시용) */
  nameParts: string[];
  /** 데스크에서 사용할 품목 여부 */
  deskEnabled: boolean;
  name: string;
  specLabel: string;
  /** 실무 입력 포장단위 */
  packageUnit: string;
  /** 농식품 품목코드 대·중·소(전국 공통) — 미입력 허용 */
  mafraLarge: string | null;
  mafraMid: string | null;
  mafraSmall: string | null;
  /** 단위·등급·포장 CODEID — 미입력·모름 시 null */
  mafraUnitCodeId: string | null;
  mafraGrdCodeId: string | null;
  mafraFrmlCodeId: string | null;
  /** 친환경 가격 API — 비우면 MAFRA 코드로 추정 */
  ecoCtgryCd: string | null;
  ecoItemCd: string | null;
  ecoVrtyCd: string | null;
  ecoGrdCd: string | null;
  ecoSggCd: string | null;
  ecoMrktCd: string | null;
  source: DeskProductSource;
  /** 매칭된 오픈마켓 기준 상품 여부(뼈대) */
  hasOpenMarketMatch: boolean;
  /** 담당자 확정 후 동기화가 품목명·규격을 덮어쓰지 않음 */
  displayLocked: boolean;
  /** 이카운트 원문이 확정 이후 바뀌었을 수 있음 */
  needsSourceReview: boolean;
  updatedAt: string;
};
