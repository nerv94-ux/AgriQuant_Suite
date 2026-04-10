import { prisma } from "@/components/common/auth/server/prisma";
import {
  autoFillCompetitorTarget,
  type CompetitorSource,
  type CompetitorSyncLog,
} from "@/components/desk/competitorTargets";

export type DeskProductUserDraftPayload = {
  targetPriceWon: string;
  note: string;
  updatedAt: string;
};

export type DeskCompetitorTarget = {
  id: string;
  label: string;
  url: string;
  productNo: string;
  enabled: boolean;
  createdAt: string;
  source: CompetitorSource;
  canonicalUrl: string;
  needsManualReview: boolean;
  lastSyncLog: CompetitorSyncLog | null;
};

export type DeskCompetitorDraft = {
  userId: string;
  deskProductId: string;
  targets: DeskCompetitorTarget[];
};

function normalizeCompetitorTargets(raw: string | null | undefined): DeskCompetitorTarget[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: DeskCompetitorTarget[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? "").trim();
      const label = String(row.label ?? "").trim();
      const url = String(row.url ?? "").trim();
      const productNo = String(row.productNo ?? "").trim();
      const enabled = row.enabled !== false;
      const createdAt = String(row.createdAt ?? "").trim();
      if (!id || (!url && !productNo)) continue;
      const normalized = autoFillCompetitorTarget({
        id,
        label,
        url,
        productNo,
        enabled,
        createdAt: createdAt || new Date().toISOString(),
        source: String(row.source ?? "UNKNOWN").trim().toUpperCase() as CompetitorSource,
        canonicalUrl: String(row.canonicalUrl ?? "").trim(),
        needsManualReview: row.needsManualReview === true,
        lastSyncLog:
          row.lastSyncLog && typeof row.lastSyncLog === "object" ? (row.lastSyncLog as CompetitorSyncLog) : undefined,
      });
      out.push({
        id: normalized.id,
        label: normalized.label,
        url: normalized.url,
        productNo: normalized.productNo,
        enabled: normalized.enabled,
        createdAt: normalized.createdAt,
        source: normalized.source ?? "UNKNOWN",
        canonicalUrl: normalized.canonicalUrl ?? "",
        needsManualReview: normalized.needsManualReview === true,
        lastSyncLog: normalized.lastSyncLog ?? null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function getDeskProductUserDraft(
  userId: string,
  deskProductId: string,
): Promise<DeskProductUserDraftPayload | null> {
  const row = await prisma.deskProductUserDraft.findUnique({
    where: {
      userId_deskProductId: { userId, deskProductId },
    },
  });
  if (!row) return null;
  return {
    targetPriceWon: row.targetPriceWon,
    note: row.note,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertDeskProductUserDraft(
  userId: string,
  deskProductId: string,
  data: { targetPriceWon: string; note: string },
): Promise<DeskProductUserDraftPayload> {
  const row = await prisma.deskProductUserDraft.upsert({
    where: {
      userId_deskProductId: { userId, deskProductId },
    },
    create: {
      userId,
      deskProductId,
      targetPriceWon: data.targetPriceWon,
      note: data.note,
    },
    update: {
      targetPriceWon: data.targetPriceWon,
      note: data.note,
    },
  });
  return {
    targetPriceWon: row.targetPriceWon,
    note: row.note,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getDeskProductCompetitorTargets(
  userId: string,
  deskProductId: string,
): Promise<DeskCompetitorTarget[]> {
  const row = await prisma.deskProductUserDraft.findUnique({
    where: {
      userId_deskProductId: { userId, deskProductId },
    },
    select: {
      competitorTargetsJson: true,
    },
  });
  return normalizeCompetitorTargets(row?.competitorTargetsJson);
}

export async function upsertDeskProductCompetitorTargets(
  userId: string,
  deskProductId: string,
  targets: DeskCompetitorTarget[],
): Promise<DeskCompetitorTarget[]> {
  const normalized = normalizeCompetitorTargets(JSON.stringify(targets));
  const row = await prisma.deskProductUserDraft.upsert({
    where: {
      userId_deskProductId: { userId, deskProductId },
    },
    create: {
      userId,
      deskProductId,
      targetPriceWon: "",
      note: "",
      competitorTargetsJson: JSON.stringify(normalized),
    },
    update: {
      competitorTargetsJson: JSON.stringify(normalized),
    },
    select: {
      competitorTargetsJson: true,
    },
  });
  return normalizeCompetitorTargets(row.competitorTargetsJson);
}

export async function listDeskCompetitorDrafts(limit = 100): Promise<DeskCompetitorDraft[]> {
  const rows = await prisma.deskProductUserDraft.findMany({
    where: {
      competitorTargetsJson: {
        not: "[]",
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: Math.max(1, Math.min(500, limit)),
    select: {
      userId: true,
      deskProductId: true,
      competitorTargetsJson: true,
    },
  });
  const out: DeskCompetitorDraft[] = [];
  for (const row of rows) {
    const targets = normalizeCompetitorTargets(row.competitorTargetsJson);
    if (targets.length < 1) continue;
    out.push({
      userId: row.userId,
      deskProductId: row.deskProductId,
      targets,
    });
  }
  return out;
}
