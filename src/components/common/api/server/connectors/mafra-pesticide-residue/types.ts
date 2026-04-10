/** 농산물 잔류농약 분석결과 — TI_NAQS_FRMREMN_AGCANALS_RESLT / Grid_20161206000000000390_1 */

export type MafraPesticideResidueRequest = {
  /** 표본 번호 (선택) */
  SPLORE_NO?: string;
  /** 등록 일자 (선택, 명세 기준) */
  REGIST_DE?: string;
  startIndex?: number;
  endIndex?: number;
};

export type MafraPesticideResidueItem = {
  ROW_NUM: string;
  SPLORE_NO: string;
  PRDLST_CODE: string;
  PRDLST_NM: string;
  TKAWY_STEP: string;
  CTVT_RAISNG: string;
  MKER: string;
  MKER_ADRES: string;
  CTVT_AR: string;
  EXAMIN_VOLM: string;
  EXAMIN_HRMFLNS_MTTR_CODE: string;
  EXAMIN_HRMFLNS_MTTR_NM: string;
  REGIST_DE: string;
  EXAMIN_ENGN: string;
  ANALS_RESULT: string;
};

export type MafraPesticideResidueResponseData = {
  totalCount: number;
  startIndex: number;
  endIndex: number;
  rows: MafraPesticideResidueItem[];
};
