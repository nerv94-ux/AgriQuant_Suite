import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/components/common/auth/server/authOptions";
import {
  getDeskProductCompetitorTargets,
  type DeskCompetitorTarget,
  upsertDeskProductCompetitorTargets,
} from "@/components/desk/server/deskUserDraftQueries";
import {
  autoFillCompetitorTarget,
  checkAndRepairCompetitorTarget,
  type CompetitorSource,
  type CompetitorSyncLog,
} from "@/components/desk/competitorTargets";

type OkGet = { ok: true; targets: DeskCompetitorTarget[] };
type OkPut = { ok: true; targets: DeskCompetitorTarget[] };
type OkSync = {
  ok: true;
  targets: DeskCompetitorTarget[];
  sync: {
    total: number;
    checked: number;
    repaired: number;
    manualReview: number;
    failed: number;
    logs: Array<{ id: string; label: string; source: CompetitorSource; productNo: string; log: CompetitorSyncLog }>;
  };
};
type ErrBody = { ok: false; message: string };

function normalizeIncomingTargets(value: unknown): DeskCompetitorTarget[] | null {
  if (!Array.isArray(value)) return null;
  const out: DeskCompetitorTarget[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    const label = String(row.label ?? "").trim();
    const url = String(row.url ?? "").trim();
    const productNo = String(row.productNo ?? "").trim();
    const enabled = row.enabled !== false;
    const createdAt = String(row.createdAt ?? "").trim() || new Date().toISOString();
    const source = String(row.source ?? "UNKNOWN").trim().toUpperCase() as CompetitorSource;
    const canonicalUrl = String(row.canonicalUrl ?? "").trim();
    const needsManualReview = row.needsManualReview === true;
    const lastSyncLog =
      row.lastSyncLog && typeof row.lastSyncLog === "object" ? (row.lastSyncLog as CompetitorSyncLog) : undefined;
    if (!id) continue;
    if (!url && !productNo) continue;
    const normalized = autoFillCompetitorTarget({
      id,
      label,
      url,
      productNo,
      enabled,
      createdAt,
      source,
      canonicalUrl,
      needsManualReview,
      lastSyncLog,
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
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkGet | OkPut | OkSync | ErrBody>) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : Array.isArray(req.query.id) ? req.query.id[0] : "";
  if (!id) {
    return res.status(400).json({ ok: false, message: "MISSING_ID" });
  }

  const userId = session.user.id;

  if (req.method === "GET") {
    const targets = await getDeskProductCompetitorTargets(userId, id);
    return res.status(200).json({ ok: true, targets });
  }

  if (req.method === "PUT") {
    const body = (req.body ?? {}) as { targets?: unknown };
    const normalized = normalizeIncomingTargets(body.targets);
    if (!normalized) {
      return res.status(400).json({ ok: false, message: "targets(array)가 필요합니다." });
    }
    const targets = await upsertDeskProductCompetitorTargets(userId, id, normalized);
    return res.status(200).json({ ok: true, targets });
  }

  if (req.method === "POST") {
    const action =
      typeof req.query.action === "string" ? req.query.action : Array.isArray(req.query.action) ? req.query.action[0] : "";
    if (action !== "sync") {
      return res.status(400).json({ ok: false, message: "action=sync 가 필요합니다." });
    }
    const current = await getDeskProductCompetitorTargets(userId, id);
    const logs: OkSync["sync"]["logs"] = [];
    const nextTargets: DeskCompetitorTarget[] = [];
    for (const item of current) {
      const result = await checkAndRepairCompetitorTarget(item);
      nextTargets.push({
        id: result.target.id,
        label: result.target.label,
        url: result.target.url,
        productNo: result.target.productNo,
        enabled: result.target.enabled,
        createdAt: result.target.createdAt,
        source: result.target.source ?? "UNKNOWN",
        canonicalUrl: result.target.canonicalUrl ?? "",
        needsManualReview: result.target.needsManualReview === true,
        lastSyncLog: result.target.lastSyncLog ?? null,
      });
      logs.push({
        id: result.target.id,
        label: result.target.label,
        source: result.target.source ?? "UNKNOWN",
        productNo: result.target.productNo,
        log: result.log,
      });
    }
    const saved = await upsertDeskProductCompetitorTargets(userId, id, nextTargets);
    const checked = logs.length;
    const repaired = logs.filter((row) => row.log.repaired).length;
    const manualReview = logs.filter((row) => row.log.manualReviewRequired).length;
    const failed = logs.filter((row) => !row.log.healthy).length;
    return res.status(200).json({
      ok: true,
      targets: saved,
      sync: {
        total: saved.length,
        checked,
        repaired,
        manualReview,
        failed,
        logs,
      },
    });
  }

  res.setHeader("Allow", "GET, PUT, POST");
  return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
}

