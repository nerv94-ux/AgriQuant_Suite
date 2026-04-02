import type {
  EcoPriceSettingsOverview,
  EcountSettingsOverview,
  GeminiSettingsOverview,
  KmaSettingsOverview,
} from "@/components/common/api/server/admin/providerSettings";
import type { ApiConnectorHealthStatus, ApiConnectorSummary, ApiConnectorStatus } from "./types";

type ConnectorCatalogItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  requiredKeys: string[];
  usageScope: string;
  nextStep: string;
  bindingMode: ApiConnectorSummary["bindingMode"];
  healthSupported: boolean;
};

export const connectorCatalog: ConnectorCatalogItem[] = [
  {
    id: "google-ai",
    name: "Google Gemini",
    category: "AI Connector",
    description: "AI 분석과 자동화 로직에 사용하는 공용 LLM 커넥터입니다.",
    requiredKeys: ["GEMINI_API_KEY"],
    usageScope: "공용 기본값",
    bindingMode: "shared-default",
    nextStep: "현재 운영 기능을 유지하면서, 이후 프로그램별 모델 선택 정책을 상단 계층에 추가합니다.",
    healthSupported: true,
  },
  {
    id: "eco-price",
    name: "친환경 농산물 가격정보",
    category: "Agri Market Data",
    description: "친환경 농산물 시세를 조회하는 공용 가격 커넥터입니다.",
    requiredKeys: ["ECO_PRICE_SERVICE_KEY"],
    usageScope: "시세/지표 모듈",
    bindingMode: "program-selectable",
    nextStep: "류/품목/품종/등급/지역/시장 필터를 기준으로 대시보드 지표를 확장합니다.",
    healthSupported: true,
  },
  {
    id: "kma-weather",
    name: "기상청 Open API",
    category: "Weather Data",
    description: "기상특보/단기예보를 동일 키로 조회하는 공용 기상 커넥터입니다.",
    requiredKeys: ["KMA_SERVICE_KEY"],
    usageScope: "기상 리스크 모듈",
    bindingMode: "program-selectable",
    nextStep: "특보 구역코드/격자 좌표를 기준으로 프로그램별 농가 지점을 매핑해 자동 알림 흐름을 확장합니다.",
    healthSupported: true,
  },
  {
    id: "ecount",
    name: "eCount API",
    category: "ERP / Backoffice",
    description: "ERP 연동을 위한 인증/조회 커넥터입니다.",
    requiredKeys: ["ECOUNT_COM_CODE", "ECOUNT_USER_ID", "ECOUNT_API_CERT_KEY", "ECOUNT_ZONE"],
    usageScope: "공용 기본값",
    bindingMode: "program-selectable",
    nextStep: "Zone + Login 연결확인까지 우선 적용하고, 이후 발주서/품목/재고 조회를 순차 확장합니다.",
    healthSupported: true,
  },
  {
    id: "naver-shopping",
    name: "네이버 쇼핑 API",
    category: "Commerce Intelligence",
    description: "온라인 가격 비교 및 소비자 지표 수집에 사용할 커넥터입니다.",
    requiredKeys: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
    usageScope: "프로그램별 선택 예정",
    bindingMode: "program-selectable",
    nextStep: "향후 프로그램 모듈과 연결해 데이터 수집 대상과 인증 정보를 분리 관리합니다.",
    healthSupported: false,
  },
];

export function toSetupStatus(requiredKeys: string[], configuredKeys: string[]): ApiConnectorStatus {
  if (configuredKeys.length === 0) {
    return "missing";
  }

  if (configuredKeys.length === requiredKeys.length) {
    return "configured";
  }

  return "partial";
}

export function toSetupLabel(status: ApiConnectorStatus) {
  if (status === "configured") {
    return "준비 완료";
  }

  if (status === "partial") {
    return "일부 설정";
  }

  return "설정 필요";
}

export function toHealthLabel(status: ApiConnectorHealthStatus) {
  if (status === "healthy") {
    return "정상 작동";
  }

  if (status === "unhealthy") {
    return "작동 실패";
  }

  if (status === "checking") {
    return "확인 중";
  }

  if (status === "unsupported") {
    return "준비 중";
  }

  return "미확인";
}

export function buildConnectorSummaries(params: {
  geminiOverview: GeminiSettingsOverview;
  ecountOverview: EcountSettingsOverview;
  kmaOverview: KmaSettingsOverview;
  ecoPriceOverview: EcoPriceSettingsOverview;
}): ApiConnectorSummary[] {
  const { geminiOverview, ecountOverview, kmaOverview, ecoPriceOverview } = params;
  return connectorCatalog.map((connector) => {
    const configuredKeys =
      connector.id === "google-ai"
        ? geminiOverview.keyStatus.configured
          ? ["GEMINI_API_KEY"]
          : []
        : connector.id === "ecount"
          ? ecountOverview.keyStatus.configuredKeys
        : connector.id === "kma-weather"
          ? kmaOverview.keyStatus.configured
            ? ["KMA_SERVICE_KEY"]
            : []
        : connector.id === "eco-price"
          ? ecoPriceOverview.keyStatus.configured
            ? ["ECO_PRICE_SERVICE_KEY"]
            : []
        : connector.requiredKeys.filter((key) => Boolean(process.env[key]));

    const setupStatus = toSetupStatus(connector.requiredKeys, configuredKeys);

    if (connector.id === "google-ai") {
      return {
        ...connector,
        configuredKeys,
        setupStatus,
        setupLabel: toSetupLabel(setupStatus),
        healthStatus: geminiOverview.health.status,
        healthLabel: toHealthLabel(geminiOverview.health.status),
        healthMessage: geminiOverview.health.message,
        lastCheckedAt: geminiOverview.health.lastCheckedAt,
        healthDurationMs: geminiOverview.health.durationMs,
        healthSupported: connector.healthSupported,
        healthStale: geminiOverview.health.stale,
      };
    }

    if (connector.id === "ecount") {
      return {
        ...connector,
        configuredKeys,
        setupStatus,
        setupLabel: toSetupLabel(setupStatus),
        healthStatus: ecountOverview.health.status,
        healthLabel: toHealthLabel(ecountOverview.health.status),
        healthMessage: ecountOverview.health.message,
        lastCheckedAt: ecountOverview.health.lastCheckedAt,
        healthDurationMs: ecountOverview.health.durationMs,
        healthSupported: connector.healthSupported,
        healthStale: ecountOverview.health.stale,
      };
    }

    if (connector.id === "kma-weather") {
      return {
        ...connector,
        configuredKeys,
        setupStatus,
        setupLabel: toSetupLabel(setupStatus),
        healthStatus: kmaOverview.health.status,
        healthLabel: toHealthLabel(kmaOverview.health.status),
        healthMessage: kmaOverview.health.message,
        lastCheckedAt: kmaOverview.health.lastCheckedAt,
        healthDurationMs: kmaOverview.health.durationMs,
        healthSupported: connector.healthSupported,
        healthStale: kmaOverview.health.stale,
      };
    }

    if (connector.id === "eco-price") {
      return {
        ...connector,
        configuredKeys,
        setupStatus,
        setupLabel: toSetupLabel(setupStatus),
        healthStatus: ecoPriceOverview.health.status,
        healthLabel: toHealthLabel(ecoPriceOverview.health.status),
        healthMessage: ecoPriceOverview.health.message,
        lastCheckedAt: ecoPriceOverview.health.lastCheckedAt,
        healthDurationMs: ecoPriceOverview.health.durationMs,
        healthSupported: connector.healthSupported,
        healthStale: ecoPriceOverview.health.stale,
      };
    }

    return {
      ...connector,
      configuredKeys,
      setupStatus,
      setupLabel: toSetupLabel(setupStatus),
      healthStatus: connector.healthSupported ? "unknown" : "unsupported",
      healthLabel: toHealthLabel(connector.healthSupported ? "unknown" : "unsupported"),
      healthMessage: connector.healthSupported
        ? "자동 연결 확인을 아직 지원하지 않습니다."
        : "자동 연결 확인은 이 커넥터 구현 후 연결됩니다.",
      lastCheckedAt: null,
      healthDurationMs: null,
      healthSupported: connector.healthSupported,
      healthStale: false,
    };
  });
}
