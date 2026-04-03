import type {
  EcoCertSettingsOverview,
  EcoPriceSettingsOverview,
  EcountSettingsOverview,
  GeminiSettingsOverview,
  KmaSettingsOverview,
  MafraSettingsOverview,
  NaverSettingsOverview,
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
    id: "eco-cert",
    name: "친환경 인증정보",
    category: "Agri Certification",
    description: "친환경 인증 단체/개인, 품목, 유효기간 정보를 조회하는 공용 인증 커넥터입니다.",
    requiredKeys: ["ECO_CERT_SERVICE_KEY"],
    usageScope: "인증 검증/품목 연계 모듈",
    bindingMode: "program-selectable",
    nextStep: "인증번호/단체명/품목명 기반 검증 흐름을 프로그램별 업무에 연결합니다.",
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
    healthSupported: true,
  },
  {
    id: "mafra-wholesale",
    name: "전국 도매시장 경매 API",
    category: "Agri Wholesale Data",
    description: "실시간 경락, 정산가격, 기간 집계와 코드사전을 운영형으로 테스트하는 커넥터입니다.",
    requiredKeys: ["MAFRA_API_KEY"],
    usageScope: "도매시장 시세/거래 분석 모듈",
    bindingMode: "program-selectable",
    nextStep: "프로그램 입력(시장명/품목명)을 코드 자동해석해 메인 API 질의로 연결합니다.",
    healthSupported: true,
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
  ecoCertOverview: EcoCertSettingsOverview;
  naverOverview: NaverSettingsOverview;
  mafraOverview: MafraSettingsOverview;
}): ApiConnectorSummary[] {
  const { geminiOverview, ecountOverview, kmaOverview, ecoPriceOverview, ecoCertOverview, naverOverview, mafraOverview } = params;
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
        : connector.id === "eco-cert"
          ? ecoCertOverview.keyStatus.configured
            ? ["ECO_CERT_SERVICE_KEY"]
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

    if (connector.id === "eco-cert") {
      return {
        ...connector,
        configuredKeys,
        setupStatus,
        setupLabel: toSetupLabel(setupStatus),
        healthStatus: ecoCertOverview.health.status,
        healthLabel: toHealthLabel(ecoCertOverview.health.status),
        healthMessage: ecoCertOverview.health.message,
        lastCheckedAt: ecoCertOverview.health.lastCheckedAt,
        healthDurationMs: ecoCertOverview.health.durationMs,
        healthSupported: connector.healthSupported,
        healthStale: ecoCertOverview.health.stale,
      };
    }

    if (connector.id === "naver-shopping") {
      const naverConfiguredKeys = naverOverview.keyStatus.configuredKeys;
      const naverSetupStatus = toSetupStatus(connector.requiredKeys, naverConfiguredKeys);
      return {
        ...connector,
        configuredKeys: naverConfiguredKeys,
        setupStatus: naverSetupStatus,
        setupLabel: toSetupLabel(naverSetupStatus),
        healthStatus: naverOverview.health.status,
        healthLabel: toHealthLabel(naverOverview.health.status),
        healthMessage: naverOverview.health.message,
        lastCheckedAt: naverOverview.health.lastCheckedAt,
        healthDurationMs: naverOverview.health.durationMs,
        healthSupported: connector.healthSupported,
        healthStale: naverOverview.health.stale,
      };
    }

    if (connector.id === "mafra-wholesale") {
      const configuredKeys = mafraOverview.keyStatus.configured ? ["MAFRA_API_KEY"] : [];
      const setupStatus = toSetupStatus(connector.requiredKeys, configuredKeys);
      return {
        ...connector,
        configuredKeys,
        setupStatus,
        setupLabel: toSetupLabel(setupStatus),
        healthStatus: mafraOverview.health.status,
        healthLabel: toHealthLabel(mafraOverview.health.status),
        healthMessage: mafraOverview.health.message,
        lastCheckedAt: mafraOverview.health.lastCheckedAt,
        healthDurationMs: mafraOverview.health.durationMs,
        healthSupported: connector.healthSupported,
        healthStale: mafraOverview.health.stale,
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
