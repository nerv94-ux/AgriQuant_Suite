import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/components/common/auth/server/authOptions";
import { prisma } from "@/components/common/auth/server/prisma";
import { collectEnabledCompetitorTargets } from "@/components/desk/server/competitorCollector";
import { getDeskProductCompetitorTargets } from "@/components/desk/server/deskUserDraftQueries";

type OkBody = {
  ok: true;
  summary: {
    totalTargets: number;
    enabledTargets: number;
    collectedTargets: number;
    success: number;
    failed: number;
    retryUsed: number;
    latestCollectedAt: string | null;
    recentSuccess: number;
    recentFailed: number;
  };
  snapshots: Array<{
    id: string;
    targetId: string;
    label: string;
    source: string;
    status: "SUCCESS" | "FAILED";
    errorMessage: string;
  }>;
};

type ErrBody = { ok: false; message: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkBody | ErrBody>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }
  const userId = session.user.id;
  const deskProductId = typeof req.query.id === "string" ? req.query.id : Array.isArray(req.query.id) ? req.query.id[0] : "";
  if (!deskProductId) {
    return res.status(400).json({ ok: false, message: "MISSING_ID" });
  }

  const maxTargetsRaw = typeof req.query.maxTargets === "string" ? Number(req.query.maxTargets) : 20;
  const maxTargets = Number.isFinite(maxTargetsRaw) ? Math.max(1, Math.min(50, Math.trunc(maxTargetsRaw))) : 20;

  const targets = await getDeskProductCompetitorTargets(userId, deskProductId);
  const enabled = targets.filter((row) => row.enabled);
  const enabledTargets = enabled.length;
  if (enabledTargets < 1) {
    return res.status(200).json({
      ok: true,
      summary: {
        totalTargets: targets.length,
        enabledTargets: 0,
        collectedTargets: 0,
        success: 0,
        failed: 0,
        retryUsed: 0,
        latestCollectedAt: null,
        recentSuccess: 0,
        recentFailed: 0,
      },
      snapshots: [],
    });
  }

  const recent = await prisma.deskCompetitorSnapshot.findMany({
    where: { userId, deskProductId },
    orderBy: { collectedAt: "desc" },
    take: 50,
    select: { status: true },
  });

  const primary = enabled[0];
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent429 = await prisma.deskCompetitorSnapshot.findFirst({
    where: {
      userId,
      deskProductId,
      source: "NAVER",
      errorMessage: "HTTP_429",
      collectedAt: { gte: sixHoursAgo },
    },
    orderBy: { collectedAt: "desc" },
    select: { collectedAt: true },
  });
  if (recent429) {
    const recentSuccess = recent.filter((row) => row.status === "SUCCESS").length;
    const recentFailed = recent.length - recentSuccess;
    return res.status(200).json({
      ok: true,
      summary: {
        totalTargets: targets.length,
        enabledTargets,
        collectedTargets: 0,
        success: 0,
        failed: 1,
        retryUsed: 0,
        latestCollectedAt: recent429.collectedAt.toISOString(),
        recentSuccess,
        recentFailed,
      },
      snapshots: [
        {
          id: "cooldown",
          targetId: primary.id,
          label: primary.label,
          source: primary.source,
          status: "FAILED",
          errorMessage: "RATE_LIMIT_COOLDOWN_ACTIVE",
        },
      ],
    });
  }

  const cachedTarget = await prisma.deskCompetitorSnapshot.findFirst({
    where: {
      userId,
      deskProductId,
      targetId: primary.id,
      collectedAt: { gte: twentyFourHoursAgo },
    },
    orderBy: { collectedAt: "desc" },
    select: {
      id: true,
      targetId: true,
      label: true,
      source: true,
      status: true,
      errorMessage: true,
      collectedAt: true,
    },
  });
  if (cachedTarget) {
    const recentSuccess = recent.filter((row) => row.status === "SUCCESS").length;
    const recentFailed = recent.length - recentSuccess;
    return res.status(200).json({
      ok: true,
      summary: {
        totalTargets: targets.length,
        enabledTargets,
        collectedTargets: 0,
        success: cachedTarget.status === "SUCCESS" ? 1 : 0,
        failed: cachedTarget.status === "FAILED" ? 1 : 0,
        retryUsed: 0,
        latestCollectedAt: cachedTarget.collectedAt.toISOString(),
        recentSuccess,
        recentFailed,
      },
      snapshots: [
        {
          id: cachedTarget.id,
          targetId: cachedTarget.targetId,
          label: cachedTarget.label,
          source: cachedTarget.source,
          status: cachedTarget.status,
          errorMessage: "CACHED_24H",
        },
      ],
    });
  }

  const collected = await collectEnabledCompetitorTargets(targets, {
    maxTargets: Math.min(maxTargets, 1),
    perTargetDelayMs: 0,
    conservativeMode: true,
    minJitterDelayMs: 20_000,
    maxJitterDelayMs: 60_000,
    maxAttempts: 1,
  });
  const rows = await prisma.$transaction(
    collected.map((item) =>
      prisma.deskCompetitorSnapshot.create({
        data: {
          userId,
          deskProductId,
          targetId: item.snapshot.targetId,
          label: item.snapshot.label,
          source: item.snapshot.source,
          productNo: item.snapshot.productNo,
          url: item.snapshot.url,
          canonicalUrl: item.snapshot.canonicalUrl,
          price: item.snapshot.price,
          optionPriceMin: item.snapshot.optionPriceMin,
          optionPriceMax: item.snapshot.optionPriceMax,
          soldOut: item.snapshot.soldOut,
          reviewCount: item.snapshot.reviewCount,
          rating: item.snapshot.rating,
          status: item.snapshot.status,
          errorMessage: item.snapshot.errorMessage,
          rawJson: item.snapshot.rawJson,
          collectedAt: new Date(),
        },
        select: {
          id: true,
          targetId: true,
          label: true,
          source: true,
          status: true,
          errorMessage: true,
          collectedAt: true,
        },
      }),
    ),
  );

  const success = rows.filter((row) => row.status === "SUCCESS").length;
  const failed = rows.length - success;
  const retryUsed = collected.filter((row) => row.retryUsed).length;
  const recentSuccess = recent.filter((row) => row.status === "SUCCESS").length;
  const recentFailed = recent.length - recentSuccess;
  const latestCollectedAt = rows[0]?.collectedAt?.toISOString() ?? null;

  return res.status(200).json({
    ok: true,
    summary: {
      totalTargets: targets.length,
      enabledTargets,
      collectedTargets: rows.length,
      success,
      failed,
      retryUsed,
      latestCollectedAt,
      recentSuccess,
      recentFailed,
    },
    snapshots: rows.map((row) => ({
      id: row.id,
      targetId: row.targetId,
      label: row.label,
      source: row.source,
      status: row.status,
      errorMessage: row.errorMessage,
    })),
  });
}
