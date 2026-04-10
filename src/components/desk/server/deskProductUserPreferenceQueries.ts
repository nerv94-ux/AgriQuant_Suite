import { prisma } from "@/components/common/auth/server/prisma";
import type { DeskProduct } from "@/types/deskProduct";
import type { DeskProductListFilter } from "@/components/desk/server/deskProductQueries";

export type DeskProductUserPreferenceDto = {
  favorite: boolean;
  sortOrder: number | null;
  lastUsedAt: Date | null;
};

export type DeskProductWithListPrefs = DeskProduct & {
  favorite: boolean;
  lastUsedAt: string | null;
};

export type DeskProductListSortMode = "alpha" | "my" | "recent";

function emptyDto(): DeskProductUserPreferenceDto {
  return {
    favorite: false,
    sortOrder: null,
    lastUsedAt: null,
  };
}

export async function getDeskProductUserPreferenceMap(
  userId: string,
  productIds: string[],
): Promise<Map<string, DeskProductUserPreferenceDto>> {
  const m = new Map<string, DeskProductUserPreferenceDto>();
  if (productIds.length === 0) return m;
  const rows = await prisma.deskProductUserPreference.findMany({
    where: { userId, deskProductId: { in: productIds } },
    select: {
      deskProductId: true,
      favorite: true,
      sortOrder: true,
      lastUsedAt: true,
    },
  });
  for (const r of rows) {
    m.set(r.deskProductId, {
      favorite: r.favorite,
      sortOrder: r.sortOrder,
      lastUsedAt: r.lastUsedAt,
    });
  }
  return m;
}

export function attachListPrefs(
  products: DeskProduct[],
  prefs: Map<string, DeskProductUserPreferenceDto>,
): DeskProductWithListPrefs[] {
  return products.map((p) => {
    const pr = prefs.get(p.id) ?? emptyDto();
    return {
      ...p,
      favorite: pr.favorite,
      lastUsedAt: pr.lastUsedAt ? pr.lastUsedAt.toISOString() : null,
    };
  });
}

function compareMyOrder(
  a: DeskProduct,
  b: DeskProduct,
  prefs: Map<string, DeskProductUserPreferenceDto>,
): number {
  const pa = prefs.get(a.id) ?? emptyDto();
  const pb = prefs.get(b.id) ?? emptyDto();
  if (pa.favorite !== pb.favorite) return pa.favorite ? -1 : 1;
  if (pa.sortOrder != null && pb.sortOrder != null && pa.sortOrder !== pb.sortOrder) {
    return pa.sortOrder - pb.sortOrder;
  }
  if (pa.sortOrder != null && pb.sortOrder == null) return -1;
  if (pa.sortOrder == null && pb.sortOrder != null) return 1;
  return a.name.localeCompare(b.name, "ko");
}

export function sortDeskProductsForListMode(
  products: DeskProduct[],
  prefs: Map<string, DeskProductUserPreferenceDto>,
  mode: DeskProductListSortMode,
): DeskProduct[] {
  const arr = [...products];
  if (mode === "alpha") {
    arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return arr;
  }
  if (mode === "recent") {
    arr.sort((a, b) => {
      const pa = prefs.get(a.id) ?? emptyDto();
      const pb = prefs.get(b.id) ?? emptyDto();
      const ta = pa.lastUsedAt?.getTime() ?? 0;
      const tb = pb.lastUsedAt?.getTime() ?? 0;
      if (ta !== tb) return tb - ta;
      return a.name.localeCompare(b.name, "ko");
    });
    return arr;
  }
  arr.sort((a, b) => compareMyOrder(a, b, prefs));
  return arr;
}

/** 드래그 후 순서·즐겨찾기 일괄 저장 (목록에 보이는 순서대로) */
export async function upsertDeskProductOrderForUser(
  userId: string,
  items: { deskProductId: string; favorite: boolean }[],
): Promise<void> {
  const step = 10;
  await prisma.$transaction(
    items.map((item, index) =>
      prisma.deskProductUserPreference.upsert({
        where: {
          userId_deskProductId: { userId, deskProductId: item.deskProductId },
        },
        create: {
          userId,
          deskProductId: item.deskProductId,
          favorite: item.favorite,
          sortOrder: index * step,
        },
        update: {
          favorite: item.favorite,
          sortOrder: index * step,
        },
      }),
    ),
  );
}

export async function setDeskProductFavorite(
  userId: string,
  deskProductId: string,
  favorite: boolean,
): Promise<void> {
  const existing = await prisma.deskProductUserPreference.findUnique({
    where: { userId_deskProductId: { userId, deskProductId } },
    select: { sortOrder: true },
  });

  if (favorite) {
    const agg = await prisma.deskProductUserPreference.aggregate({
      where: { userId },
      _min: { sortOrder: true },
    });
    const nextTop =
      agg._min.sortOrder != null ? agg._min.sortOrder - 10 : existing?.sortOrder != null ? existing.sortOrder - 10 : 0;

    await prisma.deskProductUserPreference.upsert({
      where: { userId_deskProductId: { userId, deskProductId } },
      create: {
        userId,
        deskProductId,
        favorite: true,
        sortOrder: nextTop,
      },
      update: {
        favorite: true,
        sortOrder: nextTop,
      },
    });
    return;
  }

  await prisma.deskProductUserPreference.upsert({
    where: { userId_deskProductId: { userId, deskProductId } },
    create: {
      userId,
      deskProductId,
      favorite: false,
      sortOrder: existing?.sortOrder ?? null,
    },
    update: { favorite: false },
  });
}

export async function touchDeskProductLastUsed(userId: string, deskProductId: string): Promise<void> {
  const now = new Date();
  await prisma.deskProductUserPreference.upsert({
    where: { userId_deskProductId: { userId, deskProductId } },
    create: {
      userId,
      deskProductId,
      lastUsedAt: now,
    },
    update: { lastUsedAt: now },
  });
}

/** 맨 위로(즐겨찾기 내 또는 전체에서 최상단 근처) */
export async function moveDeskProductToTop(userId: string, deskProductId: string): Promise<void> {
  const agg = await prisma.deskProductUserPreference.aggregate({
    where: { userId },
    _min: { sortOrder: true },
  });
  const nextTop = agg._min.sortOrder != null ? agg._min.sortOrder - 10 : 0;

  const row = await prisma.deskProductUserPreference.findUnique({
    where: { userId_deskProductId: { userId, deskProductId } },
    select: { favorite: true },
  });

  await prisma.deskProductUserPreference.upsert({
    where: { userId_deskProductId: { userId, deskProductId } },
    create: {
      userId,
      deskProductId,
      favorite: row?.favorite ?? false,
      sortOrder: nextTop,
    },
    update: { sortOrder: nextTop },
  });
}

type DeskPrefsJson = {
  productListFilter?: DeskProductListFilter;
  productListSort?: DeskProductListSortMode;
};

function parseDeskPrefsFromUserPreferences(raw: unknown): DeskPrefsJson {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const desk = o.desk;
  if (!desk || typeof desk !== "object" || Array.isArray(desk)) {
    return {};
  }
  const d = desk as Record<string, unknown>;
  const out: DeskPrefsJson = {};
  const f = d.productListFilter;
  if (f === "all" || f === "active" || f === "inactive") {
    out.productListFilter = f;
  }
  const s = d.productListSort;
  if (s === "alpha" || s === "my" || s === "recent") {
    out.productListSort = s;
  }
  return out;
}

export async function getDeskProductListFilterPreference(userId: string): Promise<DeskProductListFilter> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const f = parseDeskPrefsFromUserPreferences(user?.preferences ?? null).productListFilter;
  if (f === "all") return "all";
  if (f === "inactive") return "inactive";
  return "active";
}

export async function getDeskProductListSortPreference(userId: string): Promise<DeskProductListSortMode> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const s = parseDeskPrefsFromUserPreferences(user?.preferences ?? null).productListSort;
  if (s === "alpha" || s === "recent") return s;
  return "my";
}

export async function mergeUserDeskPreferences(userId: string, patch: DeskPrefsJson): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const prev = user?.preferences;
  const envelope: Record<string, unknown> =
    prev && typeof prev === "object" && !Array.isArray(prev) ? { ...(prev as object) } : {};
  const prevDesk =
    envelope.desk && typeof envelope.desk === "object" && !Array.isArray(envelope.desk)
      ? { ...(envelope.desk as object) }
      : {};
  const nextDesk = { ...prevDesk, ...patch };
  if (
    nextDesk.productListFilter !== undefined &&
    nextDesk.productListFilter !== "active" &&
    nextDesk.productListFilter !== "all" &&
    nextDesk.productListFilter !== "inactive"
  ) {
    delete nextDesk.productListFilter;
  }
  if (
    nextDesk.productListSort !== undefined &&
    nextDesk.productListSort !== "alpha" &&
    nextDesk.productListSort !== "my" &&
    nextDesk.productListSort !== "recent"
  ) {
    delete nextDesk.productListSort;
  }
  envelope.desk = nextDesk;
  await prisma.user.update({
    where: { id: userId },
    data: { preferences: envelope as object },
  });
}
