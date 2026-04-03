import { ApiProvider } from "@prisma/client";
import { prisma as db } from "@/components/common/auth/server/prisma";
import { decryptSecret, encryptSecret, maskSecret } from "./secretCrypto";
import { getMafraApiKey } from "./mafraItemCodeStore";

const GEMINI_DEFAULTS = {
  enabled: true,
  defaultModel: "gemini-2.0-flash",
  timeoutMs: 30_000,
  temperature: null as number | null,
  maxOutputTokens: null as number | null,
};

const ECOUNT_DEFAULTS = {
  enabled: true,
  lanType: "ko-KR",
  zone: "",
  envMode: "test" as const,
};

const KMA_DEFAULTS = {
  enabled: true,
  nx: 60,
  ny: 127,
  baseTime: "0500",
  pageNo: 1,
  numOfRows: 50,
};

const ECO_PRICE_DEFAULTS = {
  enabled: true,
  pageNo: 1,
  numOfRows: 50,
  fromDate: "",
  toDate: "",
  apiUrl: "",
};

const ECO_CERT_DEFAULTS = {
  enabled: true,
  pageNo: 1,
  numOfRows: 50,
  type: "JSON" as const,
  apiUrl: "https://apis.data.go.kr/1543145/ECFRDCERTINFO/getCertDataList",
};

export type GeminiConfigInput = {
  enabled: boolean;
  defaultModel: string;
  timeoutMs: number;
  temperature: number | null;
  maxOutputTokens: number | null;
  updatedByEmail?: string | null;
};

export type GeminiSettingsOverview = {
  provider: "GEMINI";
  keyStatus: {
    source: "DB" | "ENV" | "NONE";
    configured: boolean;
    maskedValue: string | null;
  };
  health: {
    status: "healthy" | "unhealthy" | "unknown";
    stale: boolean;
    lastCheckedAt: string | null;
    durationMs: number | null;
    message: string;
    requestId: string | null;
  };
  config: {
    enabled: boolean;
    defaultModel: string;
    timeoutMs: number;
    temperature: number | null;
    maxOutputTokens: number | null;
  };
  recentLogs: Array<{
    id: string;
    requestId: string;
    ok: boolean;
    appId: string | null;
    durationMs: number;
    errorCategory: string | null;
    message: string | null;
    createdAt: string;
  }>;
};

export type GeminiRuntimeConfig = {
  apiKey: string | null;
  keySource: "DB" | "ENV" | "NONE";
  enabled: boolean;
  defaultModel: string;
  timeoutMs: number;
  temperature: number | null;
  maxOutputTokens: number | null;
};

export type EcountConfigInput = {
  enabled: boolean;
  comCode: string;
  userId: string;
  zone: string;
  lanType: string;
  envMode: "test" | "prod";
  updatedByEmail?: string | null;
};

export type EcountSettingsOverview = {
  provider: "ECOUNT";
  keyStatus: {
    configured: boolean;
    configuredKeys: string[];
    maskedApiCertKey: string | null;
  };
  health: {
    status: "healthy" | "unhealthy" | "unknown";
    stale: boolean;
    lastCheckedAt: string | null;
    durationMs: number | null;
    message: string;
    requestId: string | null;
    recentFailureCount: number;
    autoStopped: boolean;
  };
  config: {
    enabled: boolean;
    comCode: string;
    userId: string;
    zone: string;
    lanType: string;
    envMode: "test" | "prod";
  };
  recentLogs: Array<{
    id: string;
    requestId: string;
    ok: boolean;
    appId: string | null;
    durationMs: number;
    errorCategory: string | null;
    message: string | null;
    createdAt: string;
  }>;
};

export type EcountRuntimeConfig = {
  enabled: boolean;
  comCode: string;
  userId: string;
  zone: string;
  lanType: string;
  envMode: "test" | "prod";
  apiCertKey: string | null;
};

export type KmaConfigInput = {
  enabled: boolean;
  nx: number;
  ny: number;
  baseTime: string;
  pageNo: number;
  numOfRows: number;
  updatedByEmail?: string | null;
};

export type KmaRuntimeConfig = {
  enabled: boolean;
  serviceKey: string | null;
  nx: number;
  ny: number;
  baseTime: string;
  pageNo: number;
  numOfRows: number;
};

export type KmaSettingsOverview = {
  provider: "KMA";
  keyStatus: {
    configured: boolean;
    maskedServiceKey: string | null;
  };
  health: {
    status: "healthy" | "unhealthy" | "unknown";
    stale: boolean;
    lastCheckedAt: string | null;
    durationMs: number | null;
    message: string;
    requestId: string | null;
  };
  config: {
    enabled: boolean;
    nx: number;
    ny: number;
    baseTime: string;
    pageNo: number;
    numOfRows: number;
  };
  recentLogs: Array<{
    id: string;
    requestId: string;
    ok: boolean;
    appId: string | null;
    durationMs: number;
    errorCategory: string | null;
    message: string | null;
    createdAt: string;
  }>;
};

export type EcoPriceConfigInput = {
  enabled: boolean;
  apiUrl: string;
  pageNo: number;
  numOfRows: number;
  fromDate: string;
  toDate: string;
  updatedByEmail?: string | null;
};

export type EcoPriceRuntimeConfig = {
  enabled: boolean;
  serviceKey: string | null;
  apiUrl: string;
  pageNo: number;
  numOfRows: number;
  fromDate: string;
  toDate: string;
};

export type EcoPriceSettingsOverview = {
  provider: "ECO_PRICE";
  keyStatus: {
    configured: boolean;
    maskedServiceKey: string | null;
  };
  health: {
    status: "healthy" | "unhealthy" | "unknown";
    stale: boolean;
    lastCheckedAt: string | null;
    durationMs: number | null;
    message: string;
    requestId: string | null;
  };
  config: {
    enabled: boolean;
    apiUrl: string;
    pageNo: number;
    numOfRows: number;
    fromDate: string;
    toDate: string;
  };
  recentLogs: Array<{
    id: string;
    requestId: string;
    ok: boolean;
    appId: string | null;
    durationMs: number;
    errorCategory: string | null;
    message: string | null;
    createdAt: string;
  }>;
};

export type NaverSettingsOverview = {
  provider: "NAVER";
  keyStatus: {
    source: "DB" | "ENV" | "NONE";
    configured: boolean;
    configuredKeys: string[];
    maskedClientId: string | null;
    maskedClientSecret: string | null;
  };
  health: {
    status: "healthy" | "unhealthy" | "unknown";
    stale: boolean;
    lastCheckedAt: string | null;
    durationMs: number | null;
    message: string;
    requestId: string | null;
  };
  config: {
    mode: "db-or-env";
    searchEnabled: boolean;
    datalabSearchTrendEnabled: boolean;
    datalabShoppingInsightEnabled: boolean;
  };
  recentLogs: Array<{
    id: string;
    requestId: string;
    ok: boolean;
    appId: string | null;
    durationMs: number;
    errorCategory: string | null;
    message: string | null;
    createdAt: string;
  }>;
};

export type NaverRuntimeConfig = {
  clientId: string | null;
  clientSecret: string | null;
  keySource: "DB" | "ENV" | "NONE";
};

export type EcoCertConfigInput = {
  enabled: boolean;
  apiUrl: string;
  pageNo: number;
  numOfRows: number;
  type: "JSON" | "XML";
  updatedByEmail?: string | null;
};

export type EcoCertRuntimeConfig = {
  enabled: boolean;
  serviceKey: string | null;
  apiUrl: string;
  pageNo: number;
  numOfRows: number;
  type: "JSON" | "XML";
};

export type EcoCertSettingsOverview = {
  provider: "ECO_CERT";
  keyStatus: {
    configured: boolean;
    maskedServiceKey: string | null;
  };
  health: {
    status: "healthy" | "unhealthy" | "unknown";
    stale: boolean;
    lastCheckedAt: string | null;
    durationMs: number | null;
    message: string;
    requestId: string | null;
  };
  config: {
    enabled: boolean;
    apiUrl: string;
    pageNo: number;
    numOfRows: number;
    type: "JSON" | "XML";
  };
  recentLogs: Array<{
    id: string;
    requestId: string;
    ok: boolean;
    appId: string | null;
    durationMs: number;
    errorCategory: string | null;
    message: string | null;
    createdAt: string;
  }>;
};

export type MafraSettingsOverview = {
  provider: "GARAK";
  keyStatus: {
    source: "DB" | "ENV" | "NONE";
    configured: boolean;
  };
  health: {
    status: "healthy" | "unhealthy" | "unknown";
    stale: boolean;
    lastCheckedAt: string | null;
    durationMs: number | null;
    message: string;
    requestId: string | null;
  };
  recentLogs: Array<{
    id: string;
    requestId: string;
    ok: boolean;
    appId: string | null;
    durationMs: number;
    errorCategory: string | null;
    message: string | null;
    createdAt: string;
  }>;
};

function parsePositiveInt(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.round(value);
}

function parseNullableNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function normalizeModel(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : GEMINI_DEFAULTS.defaultModel;
}

async function getSecretRecord(provider: ApiProvider, keyName: string) {
  return db.apiSecret.findUnique({
    where: {
      provider_keyName: {
        provider,
        keyName,
      },
    },
  });
}

async function getSecretPlainValue(provider: ApiProvider, keyName: string) {
  const record = await getSecretRecord(provider, keyName);
  if (!record) {
    return null;
  }

  return decryptSecret({
    encryptedValue: record.encryptedValue,
    iv: record.iv,
    authTag: record.authTag,
  });
}

async function saveSecretPlainValue(params: {
  provider: ApiProvider;
  keyName: string;
  value: string;
  updatedByEmail?: string | null;
}) {
  const encrypted = encryptSecret(params.value);

  await db.apiSecret.upsert({
    where: {
      provider_keyName: {
        provider: params.provider,
        keyName: params.keyName,
      },
    },
    update: {
      ...encrypted,
      updatedByEmail: params.updatedByEmail ?? null,
    },
    create: {
      provider: params.provider,
      keyName: params.keyName,
      ...encrypted,
      updatedByEmail: params.updatedByEmail ?? null,
    },
  });
}

export async function getGeminiSecretValue() {
  const record = await getSecretRecord(ApiProvider.GEMINI, "GEMINI_API_KEY");
  if (!record) {
    return null;
  }

  return decryptSecret({
    encryptedValue: record.encryptedValue,
    iv: record.iv,
    authTag: record.authTag,
  });
}

export async function saveGeminiSecret(params: {
  apiKey: string;
  updatedByEmail?: string | null;
}) {
  const encrypted = encryptSecret(params.apiKey.trim());

  await db.apiSecret.upsert({
    where: {
      provider_keyName: {
        provider: ApiProvider.GEMINI,
        keyName: "GEMINI_API_KEY",
      },
    },
    update: {
      ...encrypted,
      updatedByEmail: params.updatedByEmail ?? null,
    },
    create: {
      provider: ApiProvider.GEMINI,
      keyName: "GEMINI_API_KEY",
      ...encrypted,
      updatedByEmail: params.updatedByEmail ?? null,
    },
  });

  await saveApiAuditLog({
    provider: ApiProvider.GEMINI,
    action: "SECRET_UPDATED",
    actorEmail: params.updatedByEmail ?? null,
    detail: "GEMINI_API_KEY",
  });
}

export async function getGeminiRuntimeConfig(): Promise<GeminiRuntimeConfig> {
  const [config, dbSecret] = await Promise.all([
    db.apiConfig.findUnique({ where: { provider: ApiProvider.GEMINI } }),
    getGeminiSecretValue(),
  ]);

  const envSecret = process.env.GEMINI_API_KEY?.trim() || null;
  const apiKey = dbSecret ?? envSecret;

  return {
    apiKey,
    keySource: dbSecret ? "DB" : envSecret ? "ENV" : "NONE",
    enabled: config?.enabled ?? GEMINI_DEFAULTS.enabled,
    defaultModel: normalizeModel(config?.defaultModel),
    timeoutMs: parsePositiveInt(config?.timeoutMs, GEMINI_DEFAULTS.timeoutMs),
    temperature: parseNullableNumber(config?.temperature),
    maxOutputTokens: config?.maxOutputTokens ?? GEMINI_DEFAULTS.maxOutputTokens,
  };
}

export async function saveGeminiConfig(input: GeminiConfigInput) {
  const data = {
    provider: ApiProvider.GEMINI,
    enabled: input.enabled,
    defaultModel: normalizeModel(input.defaultModel),
    timeoutMs: parsePositiveInt(input.timeoutMs, GEMINI_DEFAULTS.timeoutMs),
    temperature: parseNullableNumber(input.temperature),
    maxOutputTokens:
      typeof input.maxOutputTokens === "number" && input.maxOutputTokens > 0
        ? Math.round(input.maxOutputTokens)
        : null,
    updatedByEmail: input.updatedByEmail ?? null,
  };

  await db.apiConfig.upsert({
    where: { provider: ApiProvider.GEMINI },
    update: data,
    create: data,
  });

  await saveApiAuditLog({
    provider: ApiProvider.GEMINI,
    action: "CONFIG_UPDATED",
    actorEmail: input.updatedByEmail ?? null,
    detail: JSON.stringify({
      enabled: data.enabled,
      defaultModel: data.defaultModel,
      timeoutMs: data.timeoutMs,
      temperature: data.temperature,
      maxOutputTokens: data.maxOutputTokens,
    }),
  });
}

const ECOUNT_SECRET_KEYS = {
  COM_CODE: "ECOUNT_COM_CODE",
  USER_ID: "ECOUNT_USER_ID",
  API_CERT_KEY: "ECOUNT_API_CERT_KEY",
  ZONE: "ECOUNT_ZONE",
  LAN_TYPE: "ECOUNT_LAN_TYPE",
  ENV_MODE: "ECOUNT_ENV_MODE",
  ENABLED: "ECOUNT_ENABLED",
} as const;

const KMA_SECRET_KEYS = {
  SERVICE_KEY: "KMA_SERVICE_KEY",
  ENABLED: "KMA_ENABLED",
  NX: "KMA_NX",
  NY: "KMA_NY",
  BASE_TIME: "KMA_BASE_TIME",
  PAGE_NO: "KMA_PAGE_NO",
  NUM_OF_ROWS: "KMA_NUM_OF_ROWS",
} as const;

const ECO_PRICE_SECRET_KEYS = {
  SERVICE_KEY: "ECO_PRICE_SERVICE_KEY",
  ENABLED: "ECO_PRICE_ENABLED",
  PAGE_NO: "ECO_PRICE_PAGE_NO",
  NUM_OF_ROWS: "ECO_PRICE_NUM_OF_ROWS",
  FROM_DATE: "ECO_PRICE_FROM_DATE",
  TO_DATE: "ECO_PRICE_TO_DATE",
  API_URL: "ECO_PRICE_API_URL",
} as const;

const NAVER_SECRET_KEYS = {
  CLIENT_ID: "NAVER_CLIENT_ID",
  CLIENT_SECRET: "NAVER_CLIENT_SECRET",
} as const;

const ECO_CERT_SECRET_KEYS = {
  SERVICE_KEY: "ECO_CERT_SERVICE_KEY",
  ENABLED: "ECO_CERT_ENABLED",
  PAGE_NO: "ECO_CERT_PAGE_NO",
  NUM_OF_ROWS: "ECO_CERT_NUM_OF_ROWS",
  TYPE: "ECO_CERT_TYPE",
  API_URL: "ECO_CERT_API_URL",
} as const;

function parseEnabledValue(value: string | null) {
  if (!value) {
    return ECOUNT_DEFAULTS.enabled;
  }

  return value.trim() !== "0";
}

function parseEnvMode(value: string | null): "test" | "prod" {
  return value?.trim().toLowerCase() === "prod" ? "prod" : "test";
}

function parseKmaBaseTime(value: string | null) {
  const trimmed = value?.trim() ?? "";
  if (/^\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  return KMA_DEFAULTS.baseTime;
}

function parseYmd(value: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }
  return /^\d{8}$/.test(trimmed) ? trimmed : "";
}

function parseEcoCertType(value: string | null): "JSON" | "XML" {
  return value?.trim().toUpperCase() === "XML" ? "XML" : "JSON";
}

async function saveEcountPlainValue(params: {
  keyName: (typeof ECOUNT_SECRET_KEYS)[keyof typeof ECOUNT_SECRET_KEYS];
  value: string;
  updatedByEmail?: string | null;
}) {
  await saveSecretPlainValue({
    provider: ApiProvider.ECOUNT,
    keyName: params.keyName,
    value: params.value.trim(),
    updatedByEmail: params.updatedByEmail ?? null,
  });
}

export async function saveEcountSecret(params: {
  apiCertKey: string;
  updatedByEmail?: string | null;
}) {
  await saveEcountPlainValue({
    keyName: ECOUNT_SECRET_KEYS.API_CERT_KEY,
    value: params.apiCertKey.trim(),
    updatedByEmail: params.updatedByEmail ?? null,
  });

  await saveApiAuditLog({
    provider: ApiProvider.ECOUNT,
    action: "SECRET_UPDATED",
    actorEmail: params.updatedByEmail ?? null,
    detail: ECOUNT_SECRET_KEYS.API_CERT_KEY,
  });
}

export async function saveEcountConfig(input: EcountConfigInput) {
  await Promise.all([
    saveEcountPlainValue({
      keyName: ECOUNT_SECRET_KEYS.COM_CODE,
      value: input.comCode.trim(),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcountPlainValue({
      keyName: ECOUNT_SECRET_KEYS.USER_ID,
      value: input.userId.trim(),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcountPlainValue({
      keyName: ECOUNT_SECRET_KEYS.ZONE,
      value: input.zone.trim().toUpperCase(),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcountPlainValue({
      keyName: ECOUNT_SECRET_KEYS.LAN_TYPE,
      value: input.lanType.trim(),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcountPlainValue({
      keyName: ECOUNT_SECRET_KEYS.ENV_MODE,
      value: input.envMode,
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcountPlainValue({
      keyName: ECOUNT_SECRET_KEYS.ENABLED,
      value: input.enabled ? "1" : "0",
      updatedByEmail: input.updatedByEmail ?? null,
    }),
  ]);

  await saveApiAuditLog({
    provider: ApiProvider.ECOUNT,
    action: "CONFIG_UPDATED",
    actorEmail: input.updatedByEmail ?? null,
    detail: JSON.stringify({
      enabled: input.enabled,
      comCode: input.comCode.trim(),
      userId: input.userId.trim(),
      zone: input.zone.trim().toUpperCase(),
      lanType: input.lanType.trim(),
      envMode: input.envMode,
    }),
  });
}

export async function getEcountRuntimeConfig(): Promise<EcountRuntimeConfig> {
  const [comCode, userId, zone, lanType, envMode, enabled, apiCertKey] = await Promise.all([
    getSecretPlainValue(ApiProvider.ECOUNT, ECOUNT_SECRET_KEYS.COM_CODE),
    getSecretPlainValue(ApiProvider.ECOUNT, ECOUNT_SECRET_KEYS.USER_ID),
    getSecretPlainValue(ApiProvider.ECOUNT, ECOUNT_SECRET_KEYS.ZONE),
    getSecretPlainValue(ApiProvider.ECOUNT, ECOUNT_SECRET_KEYS.LAN_TYPE),
    getSecretPlainValue(ApiProvider.ECOUNT, ECOUNT_SECRET_KEYS.ENV_MODE),
    getSecretPlainValue(ApiProvider.ECOUNT, ECOUNT_SECRET_KEYS.ENABLED),
    getSecretPlainValue(ApiProvider.ECOUNT, ECOUNT_SECRET_KEYS.API_CERT_KEY),
  ]);

  return {
    enabled: parseEnabledValue(enabled),
    comCode: comCode?.trim() ?? "",
    userId: userId?.trim() ?? "",
    zone: zone?.trim().toUpperCase() ?? ECOUNT_DEFAULTS.zone,
    lanType: lanType?.trim() || ECOUNT_DEFAULTS.lanType,
    envMode: parseEnvMode(envMode),
    apiCertKey: apiCertKey?.trim() || null,
  };
}

async function saveKmaPlainValue(params: {
  keyName: (typeof KMA_SECRET_KEYS)[keyof typeof KMA_SECRET_KEYS];
  value: string;
  updatedByEmail?: string | null;
}) {
  await saveSecretPlainValue({
    provider: ApiProvider.GARAK,
    keyName: params.keyName,
    value: params.value.trim(),
    updatedByEmail: params.updatedByEmail ?? null,
  });
}

async function saveEcoPricePlainValue(params: {
  keyName: (typeof ECO_PRICE_SECRET_KEYS)[keyof typeof ECO_PRICE_SECRET_KEYS];
  value: string;
  updatedByEmail?: string | null;
}) {
  await saveSecretPlainValue({
    provider: ApiProvider.GARAK,
    keyName: params.keyName,
    value: params.value.trim(),
    updatedByEmail: params.updatedByEmail ?? null,
  });
}

export async function saveKmaSecret(params: {
  serviceKey: string;
  updatedByEmail?: string | null;
}) {
  await saveKmaPlainValue({
    keyName: KMA_SECRET_KEYS.SERVICE_KEY,
    value: params.serviceKey.trim(),
    updatedByEmail: params.updatedByEmail ?? null,
  });

  await saveApiAuditLog({
    provider: ApiProvider.GARAK,
    action: "SECRET_UPDATED",
    actorEmail: params.updatedByEmail ?? null,
    detail: KMA_SECRET_KEYS.SERVICE_KEY,
  });
}

export async function saveKmaConfig(input: KmaConfigInput) {
  await Promise.all([
    saveKmaPlainValue({
      keyName: KMA_SECRET_KEYS.ENABLED,
      value: input.enabled ? "1" : "0",
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveKmaPlainValue({
      keyName: KMA_SECRET_KEYS.NX,
      value: String(Math.round(input.nx)),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveKmaPlainValue({
      keyName: KMA_SECRET_KEYS.NY,
      value: String(Math.round(input.ny)),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveKmaPlainValue({
      keyName: KMA_SECRET_KEYS.BASE_TIME,
      value: input.baseTime,
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveKmaPlainValue({
      keyName: KMA_SECRET_KEYS.PAGE_NO,
      value: String(Math.round(input.pageNo)),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveKmaPlainValue({
      keyName: KMA_SECRET_KEYS.NUM_OF_ROWS,
      value: String(Math.round(input.numOfRows)),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
  ]);

  await saveApiAuditLog({
    provider: ApiProvider.GARAK,
    action: "CONFIG_UPDATED",
    actorEmail: input.updatedByEmail ?? null,
    detail: JSON.stringify({
      enabled: input.enabled,
      nx: input.nx,
      ny: input.ny,
      baseTime: input.baseTime,
      pageNo: input.pageNo,
      numOfRows: input.numOfRows,
    }),
  });
}

export async function getKmaRuntimeConfig(): Promise<KmaRuntimeConfig> {
  const [serviceKey, enabled, nxRaw, nyRaw, baseTimeRaw, pageNoRaw, numOfRowsRaw] = await Promise.all([
    getSecretPlainValue(ApiProvider.GARAK, KMA_SECRET_KEYS.SERVICE_KEY),
    getSecretPlainValue(ApiProvider.GARAK, KMA_SECRET_KEYS.ENABLED),
    getSecretPlainValue(ApiProvider.GARAK, KMA_SECRET_KEYS.NX),
    getSecretPlainValue(ApiProvider.GARAK, KMA_SECRET_KEYS.NY),
    getSecretPlainValue(ApiProvider.GARAK, KMA_SECRET_KEYS.BASE_TIME),
    getSecretPlainValue(ApiProvider.GARAK, KMA_SECRET_KEYS.PAGE_NO),
    getSecretPlainValue(ApiProvider.GARAK, KMA_SECRET_KEYS.NUM_OF_ROWS),
  ]);

  return {
    enabled: parseEnabledValue(enabled),
    serviceKey: serviceKey?.trim() || null,
    nx: parsePositiveInt(nxRaw ? Number(nxRaw) : null, KMA_DEFAULTS.nx),
    ny: parsePositiveInt(nyRaw ? Number(nyRaw) : null, KMA_DEFAULTS.ny),
    baseTime: parseKmaBaseTime(baseTimeRaw),
    pageNo: parsePositiveInt(pageNoRaw ? Number(pageNoRaw) : null, KMA_DEFAULTS.pageNo),
    numOfRows: parsePositiveInt(numOfRowsRaw ? Number(numOfRowsRaw) : null, KMA_DEFAULTS.numOfRows),
  };
}

export async function saveEcoPriceSecret(params: {
  serviceKey: string;
  updatedByEmail?: string | null;
}) {
  await saveEcoPricePlainValue({
    keyName: ECO_PRICE_SECRET_KEYS.SERVICE_KEY,
    value: params.serviceKey.trim(),
    updatedByEmail: params.updatedByEmail ?? null,
  });

  await saveApiAuditLog({
    provider: ApiProvider.GARAK,
    action: "SECRET_UPDATED",
    actorEmail: params.updatedByEmail ?? null,
    detail: ECO_PRICE_SECRET_KEYS.SERVICE_KEY,
  });
}

export async function saveEcoPriceConfig(input: EcoPriceConfigInput) {
  await Promise.all([
    saveEcoPricePlainValue({
      keyName: ECO_PRICE_SECRET_KEYS.ENABLED,
      value: input.enabled ? "1" : "0",
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcoPricePlainValue({
      keyName: ECO_PRICE_SECRET_KEYS.PAGE_NO,
      value: String(Math.round(input.pageNo)),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcoPricePlainValue({
      keyName: ECO_PRICE_SECRET_KEYS.NUM_OF_ROWS,
      value: String(Math.round(input.numOfRows)),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcoPricePlainValue({
      keyName: ECO_PRICE_SECRET_KEYS.API_URL,
      value: input.apiUrl,
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcoPricePlainValue({
      keyName: ECO_PRICE_SECRET_KEYS.FROM_DATE,
      value: input.fromDate,
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcoPricePlainValue({
      keyName: ECO_PRICE_SECRET_KEYS.TO_DATE,
      value: input.toDate,
      updatedByEmail: input.updatedByEmail ?? null,
    }),
  ]);

  await saveApiAuditLog({
    provider: ApiProvider.GARAK,
    action: "CONFIG_UPDATED",
    actorEmail: input.updatedByEmail ?? null,
    detail: JSON.stringify({
      enabled: input.enabled,
      apiUrl: input.apiUrl,
      pageNo: input.pageNo,
      numOfRows: input.numOfRows,
      fromDate: input.fromDate,
      toDate: input.toDate,
    }),
  });
}

export async function getEcoPriceRuntimeConfig(): Promise<EcoPriceRuntimeConfig> {
  const [serviceKey, enabled, apiUrlRaw, pageNoRaw, numOfRowsRaw, fromDateRaw, toDateRaw] = await Promise.all([
    getSecretPlainValue(ApiProvider.GARAK, ECO_PRICE_SECRET_KEYS.SERVICE_KEY),
    getSecretPlainValue(ApiProvider.GARAK, ECO_PRICE_SECRET_KEYS.ENABLED),
    getSecretPlainValue(ApiProvider.GARAK, ECO_PRICE_SECRET_KEYS.API_URL),
    getSecretPlainValue(ApiProvider.GARAK, ECO_PRICE_SECRET_KEYS.PAGE_NO),
    getSecretPlainValue(ApiProvider.GARAK, ECO_PRICE_SECRET_KEYS.NUM_OF_ROWS),
    getSecretPlainValue(ApiProvider.GARAK, ECO_PRICE_SECRET_KEYS.FROM_DATE),
    getSecretPlainValue(ApiProvider.GARAK, ECO_PRICE_SECRET_KEYS.TO_DATE),
  ]);

  return {
    enabled: parseEnabledValue(enabled),
    serviceKey: serviceKey?.trim() || null,
    apiUrl: apiUrlRaw?.trim() || ECO_PRICE_DEFAULTS.apiUrl,
    pageNo: parsePositiveInt(pageNoRaw ? Number(pageNoRaw) : null, ECO_PRICE_DEFAULTS.pageNo),
    numOfRows: parsePositiveInt(
      numOfRowsRaw ? Number(numOfRowsRaw) : null,
      ECO_PRICE_DEFAULTS.numOfRows
    ),
    fromDate: parseYmd(fromDateRaw),
    toDate: parseYmd(toDateRaw),
  };
}

async function saveNaverPlainValue(params: {
  keyName: (typeof NAVER_SECRET_KEYS)[keyof typeof NAVER_SECRET_KEYS];
  value: string;
  updatedByEmail?: string | null;
}) {
  await saveSecretPlainValue({
    provider: ApiProvider.NAVER,
    keyName: params.keyName,
    value: params.value.trim(),
    updatedByEmail: params.updatedByEmail ?? null,
  });
}

export async function saveNaverSecret(params: {
  clientId: string;
  clientSecret: string;
  updatedByEmail?: string | null;
}) {
  await Promise.all([
    saveNaverPlainValue({
      keyName: NAVER_SECRET_KEYS.CLIENT_ID,
      value: params.clientId,
      updatedByEmail: params.updatedByEmail ?? null,
    }),
    saveNaverPlainValue({
      keyName: NAVER_SECRET_KEYS.CLIENT_SECRET,
      value: params.clientSecret,
      updatedByEmail: params.updatedByEmail ?? null,
    }),
  ]);

  await saveApiAuditLog({
    provider: ApiProvider.NAVER,
    action: "SECRET_UPDATED",
    actorEmail: params.updatedByEmail ?? null,
    detail: `${NAVER_SECRET_KEYS.CLIENT_ID},${NAVER_SECRET_KEYS.CLIENT_SECRET}`,
  });
}

export async function getNaverRuntimeConfig(): Promise<NaverRuntimeConfig> {
  const [dbClientId, dbClientSecret] = await Promise.all([
    getSecretPlainValue(ApiProvider.NAVER, NAVER_SECRET_KEYS.CLIENT_ID),
    getSecretPlainValue(ApiProvider.NAVER, NAVER_SECRET_KEYS.CLIENT_SECRET),
  ]);

  const envClientId = process.env.NAVER_CLIENT_ID?.trim() || null;
  const envClientSecret = process.env.NAVER_CLIENT_SECRET?.trim() || null;
  const trimmedDbClientId = dbClientId?.trim() || null;
  const trimmedDbClientSecret = dbClientSecret?.trim() || null;
  const clientId = trimmedDbClientId || envClientId;
  const clientSecret = trimmedDbClientSecret || envClientSecret;
  const keySource = trimmedDbClientId || trimmedDbClientSecret ? "DB" : envClientId || envClientSecret ? "ENV" : "NONE";

  return {
    clientId,
    clientSecret,
    keySource,
  };
}

async function saveEcoCertPlainValue(params: {
  keyName: (typeof ECO_CERT_SECRET_KEYS)[keyof typeof ECO_CERT_SECRET_KEYS];
  value: string;
  updatedByEmail?: string | null;
}) {
  await saveSecretPlainValue({
    provider: ApiProvider.GARAK,
    keyName: params.keyName,
    value: params.value.trim(),
    updatedByEmail: params.updatedByEmail ?? null,
  });
}

export async function saveEcoCertSecret(params: {
  serviceKey: string;
  updatedByEmail?: string | null;
}) {
  await saveEcoCertPlainValue({
    keyName: ECO_CERT_SECRET_KEYS.SERVICE_KEY,
    value: params.serviceKey.trim(),
    updatedByEmail: params.updatedByEmail ?? null,
  });

  await saveApiAuditLog({
    provider: ApiProvider.GARAK,
    action: "SECRET_UPDATED",
    actorEmail: params.updatedByEmail ?? null,
    detail: ECO_CERT_SECRET_KEYS.SERVICE_KEY,
  });
}

export async function saveEcoCertConfig(input: EcoCertConfigInput) {
  await Promise.all([
    saveEcoCertPlainValue({
      keyName: ECO_CERT_SECRET_KEYS.ENABLED,
      value: input.enabled ? "1" : "0",
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcoCertPlainValue({
      keyName: ECO_CERT_SECRET_KEYS.API_URL,
      value: input.apiUrl.trim(),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcoCertPlainValue({
      keyName: ECO_CERT_SECRET_KEYS.PAGE_NO,
      value: String(Math.round(input.pageNo)),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcoCertPlainValue({
      keyName: ECO_CERT_SECRET_KEYS.NUM_OF_ROWS,
      value: String(Math.round(input.numOfRows)),
      updatedByEmail: input.updatedByEmail ?? null,
    }),
    saveEcoCertPlainValue({
      keyName: ECO_CERT_SECRET_KEYS.TYPE,
      value: input.type,
      updatedByEmail: input.updatedByEmail ?? null,
    }),
  ]);

  await saveApiAuditLog({
    provider: ApiProvider.GARAK,
    action: "CONFIG_UPDATED",
    actorEmail: input.updatedByEmail ?? null,
    detail: JSON.stringify({
      enabled: input.enabled,
      apiUrl: input.apiUrl.trim(),
      pageNo: input.pageNo,
      numOfRows: input.numOfRows,
      type: input.type,
    }),
  });
}

export async function getEcoCertRuntimeConfig(): Promise<EcoCertRuntimeConfig> {
  const [serviceKey, enabled, apiUrlRaw, pageNoRaw, numOfRowsRaw, typeRaw] = await Promise.all([
    getSecretPlainValue(ApiProvider.GARAK, ECO_CERT_SECRET_KEYS.SERVICE_KEY),
    getSecretPlainValue(ApiProvider.GARAK, ECO_CERT_SECRET_KEYS.ENABLED),
    getSecretPlainValue(ApiProvider.GARAK, ECO_CERT_SECRET_KEYS.API_URL),
    getSecretPlainValue(ApiProvider.GARAK, ECO_CERT_SECRET_KEYS.PAGE_NO),
    getSecretPlainValue(ApiProvider.GARAK, ECO_CERT_SECRET_KEYS.NUM_OF_ROWS),
    getSecretPlainValue(ApiProvider.GARAK, ECO_CERT_SECRET_KEYS.TYPE),
  ]);

  return {
    enabled: parseEnabledValue(enabled),
    serviceKey: serviceKey?.trim() || null,
    apiUrl: apiUrlRaw?.trim() || ECO_CERT_DEFAULTS.apiUrl,
    pageNo: parsePositiveInt(pageNoRaw ? Number(pageNoRaw) : null, ECO_CERT_DEFAULTS.pageNo),
    numOfRows: parsePositiveInt(numOfRowsRaw ? Number(numOfRowsRaw) : null, ECO_CERT_DEFAULTS.numOfRows),
    type: parseEcoCertType(typeRaw),
  };
}

export async function saveApiAuditLog(params: {
  provider: ApiProvider;
  action: string;
  actorEmail?: string | null;
  detail?: string | null;
}) {
  await db.apiAuditLog.create({
    data: {
      provider: params.provider,
      action: params.action,
      actorEmail: params.actorEmail ?? null,
      detail: params.detail ?? null,
    },
  });
}

export async function getGeminiSettingsOverview(): Promise<GeminiSettingsOverview> {
  const [runtimeConfig, logs, latestHealthLog] = await Promise.all([
    getGeminiRuntimeConfig(),
    db.apiCallLog.findMany({
      where: { source: "GEMINI" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.apiCallLog.findFirst({
      where: {
        source: "GEMINI",
        appId: "admin-health-check",
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const keyValue =
    runtimeConfig.keySource === "DB"
      ? await getGeminiSecretValue()
      : runtimeConfig.keySource === "ENV"
        ? process.env.GEMINI_API_KEY?.trim() || null
        : null;

  const lastCheckedAt = latestHealthLog?.createdAt ?? null;
  const staleThresholdMs = 5 * 60 * 1000;
  const stale = lastCheckedAt
    ? Date.now() - lastCheckedAt.getTime() > staleThresholdMs
    : true;

  return {
    provider: "GEMINI",
    keyStatus: {
      source: runtimeConfig.keySource,
      configured: Boolean(runtimeConfig.apiKey),
      maskedValue: keyValue ? maskSecret(keyValue) : null,
    },
    health: {
      status: latestHealthLog ? (latestHealthLog.ok ? "healthy" : "unhealthy") : "unknown",
      stale,
      lastCheckedAt: lastCheckedAt ? lastCheckedAt.toISOString() : null,
      durationMs: latestHealthLog?.durationMs ?? null,
      message: latestHealthLog?.message ?? "아직 자동 연결 확인 기록이 없습니다.",
      requestId: latestHealthLog?.requestId ?? null,
    },
    config: {
      enabled: runtimeConfig.enabled,
      defaultModel: runtimeConfig.defaultModel,
      timeoutMs: runtimeConfig.timeoutMs,
      temperature: runtimeConfig.temperature,
      maxOutputTokens: runtimeConfig.maxOutputTokens,
    },
    recentLogs: logs.map((log) => ({
      id: log.id,
      requestId: log.requestId,
      ok: log.ok,
      appId: log.appId,
      durationMs: log.durationMs,
      errorCategory: log.errorCategory,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function getEcountSettingsOverview(): Promise<EcountSettingsOverview> {
  const [runtimeConfig, logs, latestHealthLog, recentFailures] = await Promise.all([
    getEcountRuntimeConfig(),
    db.apiCallLog.findMany({
      where: { source: "ECOUNT" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.apiCallLog.findFirst({
      where: {
        source: "ECOUNT",
        appId: "admin-health-check",
      },
      orderBy: { createdAt: "desc" },
    }),
    db.apiCallLog.count({
      where: {
        source: "ECOUNT",
        appId: "admin-health-check",
        ok: false,
        createdAt: {
          gte: new Date(Date.now() - 6 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const staleThresholdMs = 5 * 60 * 1000;
  const lastCheckedAt = latestHealthLog?.createdAt ?? null;
  const stale = lastCheckedAt
    ? Date.now() - lastCheckedAt.getTime() > staleThresholdMs
    : true;

  const configuredKeys = [
    runtimeConfig.comCode ? "ECOUNT_COM_CODE" : null,
    runtimeConfig.userId ? "ECOUNT_USER_ID" : null,
    runtimeConfig.apiCertKey ? "ECOUNT_API_CERT_KEY" : null,
    runtimeConfig.zone ? "ECOUNT_ZONE" : null,
  ].filter(Boolean) as string[];

  const autoStopped = recentFailures >= 10;

  return {
    provider: "ECOUNT",
    keyStatus: {
      configured: configuredKeys.length === 4,
      configuredKeys,
      maskedApiCertKey: runtimeConfig.apiCertKey ? maskSecret(runtimeConfig.apiCertKey) : null,
    },
    health: {
      status: latestHealthLog ? (latestHealthLog.ok ? "healthy" : "unhealthy") : "unknown",
      stale,
      lastCheckedAt: lastCheckedAt ? lastCheckedAt.toISOString() : null,
      durationMs: latestHealthLog?.durationMs ?? null,
      message: latestHealthLog?.message ?? "아직 eCount 연결 확인 기록이 없습니다.",
      requestId: latestHealthLog?.requestId ?? null,
      recentFailureCount: recentFailures,
      autoStopped,
    },
    config: {
      enabled: runtimeConfig.enabled,
      comCode: runtimeConfig.comCode,
      userId: runtimeConfig.userId,
      zone: runtimeConfig.zone,
      lanType: runtimeConfig.lanType,
      envMode: runtimeConfig.envMode,
    },
    recentLogs: logs.map((log) => ({
      id: log.id,
      requestId: log.requestId,
      ok: log.ok,
      appId: log.appId,
      durationMs: log.durationMs,
      errorCategory: log.errorCategory,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function getKmaSettingsOverview(): Promise<KmaSettingsOverview> {
  const [runtimeConfig, logs, latestHealthLog] = await Promise.all([
    getKmaRuntimeConfig(),
    db.apiCallLog.findMany({
      where: { source: "KMA" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.apiCallLog.findFirst({
      where: {
        source: "KMA",
        appId: "admin-health-check",
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const staleThresholdMs = 5 * 60 * 1000;
  const lastCheckedAt = latestHealthLog?.createdAt ?? null;
  const stale = lastCheckedAt ? Date.now() - lastCheckedAt.getTime() > staleThresholdMs : true;

  return {
    provider: "KMA",
    keyStatus: {
      configured: Boolean(runtimeConfig.serviceKey),
      maskedServiceKey: runtimeConfig.serviceKey ? maskSecret(runtimeConfig.serviceKey) : null,
    },
    health: {
      status: latestHealthLog ? (latestHealthLog.ok ? "healthy" : "unhealthy") : "unknown",
      stale,
      lastCheckedAt: lastCheckedAt ? lastCheckedAt.toISOString() : null,
      durationMs: latestHealthLog?.durationMs ?? null,
      message: latestHealthLog?.message ?? "아직 기상청 연결 확인 기록이 없습니다.",
      requestId: latestHealthLog?.requestId ?? null,
    },
    config: {
      enabled: runtimeConfig.enabled,
      nx: runtimeConfig.nx,
      ny: runtimeConfig.ny,
      baseTime: runtimeConfig.baseTime,
      pageNo: runtimeConfig.pageNo,
      numOfRows: runtimeConfig.numOfRows,
    },
    recentLogs: logs.map((log) => ({
      id: log.id,
      requestId: log.requestId,
      ok: log.ok,
      appId: log.appId,
      durationMs: log.durationMs,
      errorCategory: log.errorCategory,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function getEcoPriceSettingsOverview(): Promise<EcoPriceSettingsOverview> {
  const [runtimeConfig, logs, latestHealthLog] = await Promise.all([
    getEcoPriceRuntimeConfig(),
    db.apiCallLog.findMany({
      where: { source: "ECO_PRICE" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.apiCallLog.findFirst({
      where: {
        source: "ECO_PRICE",
        appId: "admin-health-check",
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const staleThresholdMs = 5 * 60 * 1000;
  const lastCheckedAt = latestHealthLog?.createdAt ?? null;
  const stale = lastCheckedAt ? Date.now() - lastCheckedAt.getTime() > staleThresholdMs : true;

  return {
    provider: "ECO_PRICE",
    keyStatus: {
      configured: Boolean(runtimeConfig.serviceKey),
      maskedServiceKey: runtimeConfig.serviceKey ? maskSecret(runtimeConfig.serviceKey) : null,
    },
    health: {
      status: latestHealthLog ? (latestHealthLog.ok ? "healthy" : "unhealthy") : "unknown",
      stale,
      lastCheckedAt: lastCheckedAt ? lastCheckedAt.toISOString() : null,
      durationMs: latestHealthLog?.durationMs ?? null,
      message: latestHealthLog?.message ?? "아직 친환경 가격 API 연결 확인 기록이 없습니다.",
      requestId: latestHealthLog?.requestId ?? null,
    },
    config: {
      enabled: runtimeConfig.enabled,
      apiUrl: runtimeConfig.apiUrl,
      pageNo: runtimeConfig.pageNo,
      numOfRows: runtimeConfig.numOfRows,
      fromDate: runtimeConfig.fromDate,
      toDate: runtimeConfig.toDate,
    },
    recentLogs: logs.map((log) => ({
      id: log.id,
      requestId: log.requestId,
      ok: log.ok,
      appId: log.appId,
      durationMs: log.durationMs,
      errorCategory: log.errorCategory,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function getEcoCertSettingsOverview(): Promise<EcoCertSettingsOverview> {
  const [runtimeConfig, logs, latestHealthLog] = await Promise.all([
    getEcoCertRuntimeConfig(),
    db.apiCallLog.findMany({
      where: { source: "ECO_CERT" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.apiCallLog.findFirst({
      where: {
        source: "ECO_CERT",
        appId: "admin-health-check",
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const staleThresholdMs = 5 * 60 * 1000;
  const lastCheckedAt = latestHealthLog?.createdAt ?? null;
  const stale = lastCheckedAt ? Date.now() - lastCheckedAt.getTime() > staleThresholdMs : true;

  return {
    provider: "ECO_CERT",
    keyStatus: {
      configured: Boolean(runtimeConfig.serviceKey),
      maskedServiceKey: runtimeConfig.serviceKey ? maskSecret(runtimeConfig.serviceKey) : null,
    },
    health: {
      status: latestHealthLog ? (latestHealthLog.ok ? "healthy" : "unhealthy") : "unknown",
      stale,
      lastCheckedAt: lastCheckedAt ? lastCheckedAt.toISOString() : null,
      durationMs: latestHealthLog?.durationMs ?? null,
      message: latestHealthLog?.message ?? "아직 친환경 인증정보 API 연결 확인 기록이 없습니다.",
      requestId: latestHealthLog?.requestId ?? null,
    },
    config: {
      enabled: runtimeConfig.enabled,
      apiUrl: runtimeConfig.apiUrl,
      pageNo: runtimeConfig.pageNo,
      numOfRows: runtimeConfig.numOfRows,
      type: runtimeConfig.type,
    },
    recentLogs: logs.map((log) => ({
      id: log.id,
      requestId: log.requestId,
      ok: log.ok,
      appId: log.appId,
      durationMs: log.durationMs,
      errorCategory: log.errorCategory,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function getNaverSettingsOverview(): Promise<NaverSettingsOverview> {
  const [runtimeConfig, logs, latestHealthLog] = await Promise.all([
    getNaverRuntimeConfig(),
    db.apiCallLog.findMany({
      where: { source: "NAVER" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.apiCallLog.findFirst({
      where: {
        source: "NAVER",
        appId: "admin-health-check",
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const clientId = runtimeConfig.clientId ?? "";
  const clientSecret = runtimeConfig.clientSecret ?? "";
  const configuredKeys = [
    clientId ? "NAVER_CLIENT_ID" : null,
    clientSecret ? "NAVER_CLIENT_SECRET" : null,
  ].filter(Boolean) as string[];
  const lastCheckedAt = latestHealthLog?.createdAt ?? null;
  const staleThresholdMs = 5 * 60 * 1000;
  const stale = lastCheckedAt ? Date.now() - lastCheckedAt.getTime() > staleThresholdMs : true;

  return {
    provider: "NAVER",
    keyStatus: {
      source: runtimeConfig.keySource,
      configured: configuredKeys.length === 2,
      configuredKeys,
      maskedClientId: clientId ? maskSecret(clientId) : null,
      maskedClientSecret: clientSecret ? maskSecret(clientSecret) : null,
    },
    health: {
      status: latestHealthLog ? (latestHealthLog.ok ? "healthy" : "unhealthy") : "unknown",
      stale,
      lastCheckedAt: lastCheckedAt ? lastCheckedAt.toISOString() : null,
      durationMs: latestHealthLog?.durationMs ?? null,
      message: latestHealthLog?.message ?? "아직 네이버 API 연결 확인 기록이 없습니다.",
      requestId: latestHealthLog?.requestId ?? null,
    },
    config: {
      mode: "db-or-env",
      searchEnabled: true,
      datalabSearchTrendEnabled: true,
      datalabShoppingInsightEnabled: true,
    },
    recentLogs: logs.map((log) => ({
      id: log.id,
      requestId: log.requestId,
      ok: log.ok,
      appId: log.appId,
      durationMs: log.durationMs,
      errorCategory: log.errorCategory,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function getMafraSettingsOverview(): Promise<MafraSettingsOverview> {
  const [apiKey, latestHealthLog, recentLogs] = await Promise.all([
    getMafraApiKey(),
    db.apiCallLog.findFirst({
      where: {
        source: "GARAK",
        appId: "admin-health-check",
      },
      orderBy: { createdAt: "desc" },
    }),
    db.apiCallLog.findMany({
      where: {
        source: "GARAK",
        appId: {
          startsWith: "admin-mafra",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const envKey = process.env.MAFRA_API_KEY?.trim() || null;
  const source: "DB" | "ENV" | "NONE" = apiKey ? (envKey && apiKey === envKey ? "ENV" : "DB") : "NONE";
  const lastCheckedAt = latestHealthLog?.createdAt ?? null;
  const staleThresholdMs = 5 * 60 * 1000;
  const stale = lastCheckedAt ? Date.now() - lastCheckedAt.getTime() > staleThresholdMs : true;

  return {
    provider: "GARAK",
    keyStatus: {
      source,
      configured: Boolean(apiKey),
    },
    health: {
      status: latestHealthLog ? (latestHealthLog.ok ? "healthy" : "unhealthy") : "unknown",
      stale,
      lastCheckedAt: lastCheckedAt ? lastCheckedAt.toISOString() : null,
      durationMs: latestHealthLog?.durationMs ?? null,
      message: latestHealthLog?.message ?? "아직 전국 도매시장 경매 API 연결 확인 기록이 없습니다.",
      requestId: latestHealthLog?.requestId ?? null,
    },
    recentLogs: recentLogs.map((log) => ({
      id: log.id,
      requestId: log.requestId,
      ok: log.ok,
      appId: log.appId,
      durationMs: log.durationMs,
      errorCategory: log.errorCategory,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}
