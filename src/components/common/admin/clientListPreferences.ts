type AdminListPreferenceRecord = {
  order: string[];
  pinned: string[];
  updatedAt: string;
};

type AdminListPreferencesEnvelope = {
  version: 1;
  lists: Record<string, AdminListPreferenceRecord>;
};

export type AdminListPreference = {
  order: string[];
  pinned: string[];
};

const STORAGE_KEY = "admin:common:list-preferences:v1";

function normalizeIds(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (typeof value !== "string" || value.length === 0 || seen.has(value)) {
      continue;
    }
    seen.add(value);
    output.push(value);
  }

  return output;
}

function readEnvelope(): AdminListPreferencesEnvelope {
  if (typeof window === "undefined") {
    return { version: 1, lists: {} };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { version: 1, lists: {} };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AdminListPreferencesEnvelope>;
    if (parsed.version !== 1 || typeof parsed.lists !== "object" || !parsed.lists) {
      return { version: 1, lists: {} };
    }

    const lists: Record<string, AdminListPreferenceRecord> = {};
    for (const [listId, record] of Object.entries(parsed.lists)) {
      if (!record || typeof record !== "object") {
        continue;
      }
      const entry = record as Partial<AdminListPreferenceRecord>;
      lists[listId] = {
        order: normalizeIds(entry.order),
        pinned: normalizeIds(entry.pinned),
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : new Date(0).toISOString(),
      };
    }

    return { version: 1, lists };
  } catch {
    return { version: 1, lists: {} };
  }
}

export function loadAdminListPreference(listId: string): AdminListPreference | null {
  const envelope = readEnvelope();
  const hit = envelope.lists[listId];
  if (!hit) {
    return null;
  }
  return {
    order: hit.order,
    pinned: hit.pinned,
  };
}

export function saveAdminListPreference(listId: string, preference: AdminListPreference) {
  if (typeof window === "undefined") {
    return;
  }

  const envelope = readEnvelope();
  envelope.lists[listId] = {
    order: normalizeIds(preference.order),
    pinned: normalizeIds(preference.pinned),
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}
