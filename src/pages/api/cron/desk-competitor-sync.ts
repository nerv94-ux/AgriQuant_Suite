import type { NextApiRequest, NextApiResponse } from "next";

import { checkAndRepairCompetitorTarget, type CompetitorSource, type CompetitorSyncLog } from "@/components/desk/competitorTargets";
import {
  listDeskCompetitorDrafts,
  type DeskCompetitorTarget,
  upsertDeskProductCompetitorTargets,
} from "@/components/desk/server/deskUserDraftQueries";

type SyncLogItem = {
  userId: string;
  deskProductId: string;
  id: string;
  label: string;
  source: CompetitorSource;
  productNo: string;
  log: CompetitorSyncLog;
};

type OkBody = {
  ok: true;
  summary: {
    drafts: number;
    targets: number;
    checked: number;
    repaired: number;
    manualReview: number;
    failed: number;
  };
  logs: SyncLogItem[];
};

type ErrBody = {
  ok: false;
  message: string;
};

function readSecret(req: NextApiRequest): string {
  const bearer = req.headers.authorization?.trim() ?? "";
  if (bearer.toLowerCase().startsWith("bearer ")) {
    return bearer.slice(7).trim();
  }
  const xCronSecret = req.headers["x-cron-secret"];
  if (typeof xCronSecret === "string") return xCronSecret.trim();
  return "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkBody | ErrBody>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const requiredSecret = process.env.CRON_SECRET?.trim() ?? "";
  if (!requiredSecret) {
    return res.status(500).json({ ok: false, message: "CRON_SECRET_NOT_CONFIGURED" });
  }
  if (readSecret(req) !== requiredSecret) {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 100;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : 100;
  const drafts = await listDeskCompetitorDrafts(limit);

  const logs: SyncLogItem[] = [];
  let targets = 0;
  for (const draft of drafts) {
    const nextTargets: DeskCompetitorTarget[] = [];
    for (const item of draft.targets) {
      targets += 1;
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
        userId: draft.userId,
        deskProductId: draft.deskProductId,
        id: result.target.id,
        label: result.target.label,
        source: result.target.source ?? "UNKNOWN",
        productNo: result.target.productNo,
        log: result.log,
      });
    }
    await upsertDeskProductCompetitorTargets(draft.userId, draft.deskProductId, nextTargets);
  }

  const checked = logs.length;
  const repaired = logs.filter((row) => row.log.repaired).length;
  const manualReview = logs.filter((row) => row.log.manualReviewRequired).length;
  const failed = logs.filter((row) => !row.log.healthy).length;

  return res.status(200).json({
    ok: true,
    summary: {
      drafts: drafts.length,
      targets,
      checked,
      repaired,
      manualReview,
      failed,
    },
    logs,
  });
}
