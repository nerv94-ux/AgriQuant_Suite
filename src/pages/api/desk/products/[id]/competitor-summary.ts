import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/components/common/auth/server/authOptions";
import { prisma } from "@/components/common/auth/server/prisma";
import { summarizeCompetitorSnapshots } from "@/components/desk/server/competitorSummary";

type OkBody = {
  ok: true;
  summary: {
    metrics: {
      totalSnapshots: number;
      successSnapshots: number;
      failedSnapshots: number;
      successRatePct: number;
      latestCollectedAt: string | null;
      priceMin: number | null;
      priceMax: number | null;
      priceAvg: number | null;
      soldOutCount: number;
      reviewCountAvg: number | null;
      ratingAvg: number | null;
    };
    llmSummary: {
      summary: string;
      strengths: string[];
      risks: string[];
      complaintKeywords: string[];
      evidence: string[];
    };
    usedSnapshots: number;
    fallbackUsed: boolean;
  };
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

  const deskProductId = typeof req.query.id === "string" ? req.query.id : Array.isArray(req.query.id) ? req.query.id[0] : "";
  if (!deskProductId) {
    return res.status(400).json({ ok: false, message: "MISSING_ID" });
  }
  const userId = session.user.id;
  const body = (req.body ?? {}) as { windowSize?: unknown };
  const windowSizeRaw = typeof body.windowSize === "number" ? body.windowSize : 30;
  const windowSize = Math.max(5, Math.min(120, Math.trunc(windowSizeRaw)));

  const product = await prisma.deskProduct.findUnique({
    where: { id: deskProductId },
    select: { name: true },
  });
  if (!product) {
    return res.status(404).json({ ok: false, message: "PRODUCT_NOT_FOUND" });
  }

  const snapshots = await prisma.deskCompetitorSnapshot.findMany({
    where: { userId, deskProductId },
    orderBy: { collectedAt: "desc" },
    take: windowSize,
    select: {
      id: true,
      targetId: true,
      label: true,
      source: true,
      productNo: true,
      url: true,
      price: true,
      optionPriceMin: true,
      optionPriceMax: true,
      soldOut: true,
      reviewCount: true,
      rating: true,
      status: true,
      errorMessage: true,
      collectedAt: true,
    },
  });

  const summary = await summarizeCompetitorSnapshots({
    snapshots: snapshots.map((row) => ({
      ...row,
      status: row.status as "SUCCESS" | "FAILED",
    })),
    productName: product.name,
  });

  return res.status(200).json({ ok: true, summary });
}
