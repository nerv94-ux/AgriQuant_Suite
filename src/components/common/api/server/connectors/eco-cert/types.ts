export type EcoCertListRequest = {
  pageNo?: number;
  numOfRows?: number;
  type?: "JSON" | "XML";
  chcCol?: string;
  certNo?: string;
  certSeCd?: string;
  certVldEndYmdS?: string;
  certVldEndYmdE?: string;
  prdcrGrpNm?: string;
  rprsvNm?: string;
  plorNm?: string;
  certItemNm?: string;
};

export type EcoCertItem = {
  CERT_NO?: string;
  CERT_SE_CD?: string;
  CERT_VLD_BGNG_YMD?: string;
  CERT_VLD_END_YMD?: string;
  PLOR_NM?: string;
  CERT_INST_CD?: string;
  CERT_INST_NM?: string;
  CERT_INST_TELNO?: string;
  PRDCR_SE_NM?: string;
  PRDCR_GRP_MNG_NO?: string;
  PRDCR_GRP_NM?: string;
  RPRSV_NM?: string;
  GRP_STDG_CD?: string;
  GRP_STDG_CD_NM?: string;
  GRP_TELNO?: string;
  FARM_CNT?: string;
  CERT_ITEM_NM?: string;
  CLTVTN_AREA_VL?: string;
  PRDCTN_INCM_PQTY?: string;
  FRST_CERT_YMD?: string;
  [key: string]: unknown;
};

export type EcoCertListResponseData = {
  totalCount: number;
  pageNo: number;
  numOfRows: number;
  rows: EcoCertItem[];
};

export type EcoCertHealthResponseData = {
  totalCount: number;
};

export type EcoCertApiRawResponse = {
  HEAD?: {
    resultCode?: string;
    resultMsg?: string;
    totalCount?: number | string;
    numOfRows?: number | string;
    pageNo?: number | string;
  };
  DATA?: {
    ROW?: unknown[] | unknown;
  };
};
