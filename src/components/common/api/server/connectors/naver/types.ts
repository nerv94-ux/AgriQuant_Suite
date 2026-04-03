export type NaverSearchResponseData = {
  total: number;
  start: number;
  display: number;
  items: Array<Record<string, unknown>>;
};

export type NaverDatalabSearchTrendRequest = {
  startDate: string;
  endDate: string;
  timeUnit: "date" | "week" | "month";
  keywordGroups: Array<{
    groupName: string;
    keywords: string[];
  }>;
};

export type NaverDatalabSearchTrendResponseData = {
  startDate: string;
  endDate: string;
  timeUnit: string;
  results: Array<{
    title: string;
    keywords: string[];
    data: Array<{ period: string; ratio: number }>;
  }>;
};

export type NaverDatalabShoppingInsightRequest = {
  startDate: string;
  endDate: string;
  timeUnit: "date" | "week" | "month";
  category: Array<{
    name: string;
    param: string[];
  }>;
};

export type NaverDatalabShoppingInsightResponseData = {
  startDate: string;
  endDate: string;
  timeUnit: string;
  results: Array<{
    title: string;
    category: string[];
    data: Array<{ period: string; ratio: number }>;
  }>;
};

export type NaverHealthResponseData = {
  searchTotal: number;
  trendSeriesCount: number;
  shoppingSeriesCount: number;
};
