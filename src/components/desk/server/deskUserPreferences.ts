import { prisma } from "@/components/common/auth/server/prisma";
import type { DeskProductListFilter } from "@/components/desk/server/deskProductQueries";
import type { DeskProductListSortMode } from "@/components/desk/server/deskProductUserPreferenceQueries";

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
