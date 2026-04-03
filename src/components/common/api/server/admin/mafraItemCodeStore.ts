import { ApiProvider } from "@prisma/client";
import { prisma as db } from "@/components/common/auth/server/prisma";
import { decryptSecret, encryptSecret } from "./secretCrypto";

const MAFRA_API_KEY_NAME = "MAFRA_API_KEY";
const MAFRA_ITEM_CODE_CACHE_KEY = "MAFRA_ITEM_CODE_CACHE_JSON";
const MAFRA_MARKET_CODE_CACHE_KEY = "MAFRA_MARKET_CODE_CACHE_JSON";
const MAFRA_CORP_CODE_CACHE_KEY = "MAFRA_CORP_CODE_CACHE_JSON";
const MAFRA_UNIT_CODE_CACHE_KEY = "MAFRA_UNIT_CODE_CACHE_JSON";
const MAFRA_FRML_CODE_CACHE_KEY = "MAFRA_FRML_CODE_CACHE_JSON";
const MAFRA_GRD_CODE_CACHE_KEY = "MAFRA_GRD_CODE_CACHE_JSON";
const MAFRA_PLOR_CODE_CACHE_KEY = "MAFRA_PLOR_CODE_CACHE_JSON";

type MafraItemCodeRecord = {
  LARGE: string;
  MID: string;
  SMALL: string;
  LARGENAME: string;
  MIDNAME: string;
  GOODNAME: string;
  GUBN: string;
};

type MafraMarketCodeRecord = {
  CODEID: string;
  CODENAME: string;
};

type MafraCorpCodeRecord = {
  CODEID: string;
  CODENAME: string;
};

type MafraUnitCodeRecord = {
  CODEID: string;
  CODENAME: string;
};

type MafraFrmlCodeRecord = {
  CODEID: string;
  CODENAME: string;
};

type MafraGrdCodeRecord = {
  CODEID: string;
  CODENAME: string;
};

type MafraPlorCodeRecord = {
  CODEID: string;
  CODENAME: string;
};

async function getSecretPlainValue(keyName: string) {
  const record = await db.apiSecret.findUnique({
    where: {
      provider_keyName: {
        provider: ApiProvider.GARAK,
        keyName,
      },
    },
  });
  if (!record) {
    return null;
  }
  return decryptSecret({
    encryptedValue: record.encryptedValue,
    iv: record.iv,
    authTag: record.authTag,
  });
}

async function saveSecretPlainValue(keyName: string, value: string, updatedByEmail?: string | null) {
  const encrypted = encryptSecret(value);
  await db.apiSecret.upsert({
    where: {
      provider_keyName: {
        provider: ApiProvider.GARAK,
        keyName,
      },
    },
    update: {
      ...encrypted,
      updatedByEmail: updatedByEmail ?? null,
    },
    create: {
      provider: ApiProvider.GARAK,
      keyName,
      ...encrypted,
      updatedByEmail: updatedByEmail ?? null,
    },
  });
}

export async function getMafraApiKey() {
  const dbKey = await getSecretPlainValue(MAFRA_API_KEY_NAME);
  if (dbKey?.trim()) {
    return dbKey.trim();
  }
  return process.env.MAFRA_API_KEY?.trim() || null;
}

export async function saveMafraApiKey(apiKey: string, updatedByEmail?: string | null) {
  await saveSecretPlainValue(MAFRA_API_KEY_NAME, apiKey.trim(), updatedByEmail);
}

export async function loadMafraItemCodeCache(): Promise<{
  updatedAt: string | null;
  items: MafraItemCodeRecord[];
}> {
  const raw = await getSecretPlainValue(MAFRA_ITEM_CODE_CACHE_KEY);
  if (!raw) {
    return { updatedAt: null, items: [] };
  }
  try {
    const parsed = JSON.parse(raw) as {
      updatedAt?: string;
      items?: MafraItemCodeRecord[];
    };
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { updatedAt: null, items: [] };
  }
}

export async function saveMafraItemCodeCache(
  items: MafraItemCodeRecord[],
  updatedByEmail?: string | null
) {
  await saveSecretPlainValue(
    MAFRA_ITEM_CODE_CACHE_KEY,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      items,
    }),
    updatedByEmail
  );
}

export async function loadMafraMarketCodeCache(): Promise<{
  updatedAt: string | null;
  items: MafraMarketCodeRecord[];
}> {
  const raw = await getSecretPlainValue(MAFRA_MARKET_CODE_CACHE_KEY);
  if (!raw) {
    return { updatedAt: null, items: [] };
  }
  try {
    const parsed = JSON.parse(raw) as {
      updatedAt?: string;
      items?: MafraMarketCodeRecord[];
    };
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { updatedAt: null, items: [] };
  }
}

export async function saveMafraMarketCodeCache(
  items: MafraMarketCodeRecord[],
  updatedByEmail?: string | null
) {
  await saveSecretPlainValue(
    MAFRA_MARKET_CODE_CACHE_KEY,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      items,
    }),
    updatedByEmail
  );
}

export async function loadMafraCorpCodeCache(): Promise<{
  updatedAt: string | null;
  items: MafraCorpCodeRecord[];
}> {
  const raw = await getSecretPlainValue(MAFRA_CORP_CODE_CACHE_KEY);
  if (!raw) {
    return { updatedAt: null, items: [] };
  }
  try {
    const parsed = JSON.parse(raw) as {
      updatedAt?: string;
      items?: MafraCorpCodeRecord[];
    };
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { updatedAt: null, items: [] };
  }
}

export async function saveMafraCorpCodeCache(items: MafraCorpCodeRecord[], updatedByEmail?: string | null) {
  await saveSecretPlainValue(
    MAFRA_CORP_CODE_CACHE_KEY,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      items,
    }),
    updatedByEmail
  );
}

export async function loadMafraUnitCodeCache(): Promise<{
  updatedAt: string | null;
  items: MafraUnitCodeRecord[];
}> {
  const raw = await getSecretPlainValue(MAFRA_UNIT_CODE_CACHE_KEY);
  if (!raw) {
    return { updatedAt: null, items: [] };
  }
  try {
    const parsed = JSON.parse(raw) as {
      updatedAt?: string;
      items?: MafraUnitCodeRecord[];
    };
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { updatedAt: null, items: [] };
  }
}

export async function saveMafraUnitCodeCache(items: MafraUnitCodeRecord[], updatedByEmail?: string | null) {
  await saveSecretPlainValue(
    MAFRA_UNIT_CODE_CACHE_KEY,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      items,
    }),
    updatedByEmail
  );
}

export async function loadMafraFrmlCodeCache(): Promise<{
  updatedAt: string | null;
  items: MafraFrmlCodeRecord[];
}> {
  const raw = await getSecretPlainValue(MAFRA_FRML_CODE_CACHE_KEY);
  if (!raw) {
    return { updatedAt: null, items: [] };
  }
  try {
    const parsed = JSON.parse(raw) as {
      updatedAt?: string;
      items?: MafraFrmlCodeRecord[];
    };
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { updatedAt: null, items: [] };
  }
}

export async function saveMafraFrmlCodeCache(items: MafraFrmlCodeRecord[], updatedByEmail?: string | null) {
  await saveSecretPlainValue(
    MAFRA_FRML_CODE_CACHE_KEY,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      items,
    }),
    updatedByEmail
  );
}

export async function loadMafraGrdCodeCache(): Promise<{
  updatedAt: string | null;
  items: MafraGrdCodeRecord[];
}> {
  const raw = await getSecretPlainValue(MAFRA_GRD_CODE_CACHE_KEY);
  if (!raw) {
    return { updatedAt: null, items: [] };
  }
  try {
    const parsed = JSON.parse(raw) as {
      updatedAt?: string;
      items?: MafraGrdCodeRecord[];
    };
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { updatedAt: null, items: [] };
  }
}

export async function saveMafraGrdCodeCache(items: MafraGrdCodeRecord[], updatedByEmail?: string | null) {
  await saveSecretPlainValue(
    MAFRA_GRD_CODE_CACHE_KEY,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      items,
    }),
    updatedByEmail
  );
}

export async function loadMafraPlorCodeCache(): Promise<{
  updatedAt: string | null;
  items: MafraPlorCodeRecord[];
}> {
  const raw = await getSecretPlainValue(MAFRA_PLOR_CODE_CACHE_KEY);
  if (!raw) {
    return { updatedAt: null, items: [] };
  }
  try {
    const parsed = JSON.parse(raw) as {
      updatedAt?: string;
      items?: MafraPlorCodeRecord[];
    };
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { updatedAt: null, items: [] };
  }
}

export async function saveMafraPlorCodeCache(items: MafraPlorCodeRecord[], updatedByEmail?: string | null) {
  await saveSecretPlainValue(
    MAFRA_PLOR_CODE_CACHE_KEY,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      items,
    }),
    updatedByEmail
  );
}
