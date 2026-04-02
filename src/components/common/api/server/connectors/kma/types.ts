export type KmaWarningRequest = {
  stnId?: string;
  fromTm?: string;
  toTm?: string;
};

export type KmaForecastRequest = {
  baseDate: string;
  baseTime: string;
  nx: number;
  ny: number;
  pageNo?: number;
  numOfRows?: number;
};

export type KmaItem = Record<string, unknown>;

export type KmaWarningResponseData = {
  totalCount: number;
  items: KmaItem[];
};

export type KmaForecastResponseData = {
  totalCount: number;
  items: KmaItem[];
};

export type KmaHealthResponseData = {
  warningCount: number;
  forecastCount: number;
  nx: number;
  ny: number;
  baseDate: string;
  baseTime: string;
};
