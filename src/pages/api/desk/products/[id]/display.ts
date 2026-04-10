import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { resolveDeskProductLockFingerprint } from "@/components/desk/server/ecountDeskDisplay";
import { prisma } from "@/components/common/auth/server/prisma";

type OkBody = {
  ok: true;
  product: {
    name: string;
    specLabel: string;
    packageUnit: string;
    displayLocked: boolean;
    needsSourceReview: boolean;
    updatedAt: string;
  };
};
type ErrBody = { ok: false; message: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkBody | ErrBody>) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED" || session.user.role !== "ADMIN") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : Array.isArray(req.query.id) ? req.query.id[0] : "";
  if (!id) {
    return res.status(400).json({ ok: false, message: "MISSING_ID" });
  }

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const body = (req.body ?? {}) as {
    name?: unknown;
    specLabel?: unknown;
    packageUnit?: unknown;
    displayLocked?: unknown;
  };
  if (
    typeof body.name !== "string" ||
    typeof body.specLabel !== "string" ||
    typeof body.packageUnit !== "string" ||
    typeof body.displayLocked !== "boolean"
  ) {
    return res.status(400).json({
      ok: false,
      message: "name(string), specLabel(string), packageUnit(string), displayLocked(boolean)이 필요합니다.",
    });
  }

  const name = body.name.trim() || "—";
  const specLabel = body.specLabel.trim() || "—";
  const packageUnit = body.packageUnit.trim();

  const existing = await prisma.deskProduct.findUnique({
    where: { id },
    select: {
      id: true,
      source: true,
      ecountProdCode: true,
      name: true,
      specLabel: true,
      lastApiFingerprint: true,
    },
  });

  if (!existing) {
    return res.status(404).json({ ok: false, message: "NOT_FOUND" });
  }

  if (existing.source !== "ECOUNT") {
    return res.status(400).json({ ok: false, message: "이카운트 품목만 표시명 확정을 사용할 수 있습니다." });
  }

  if (body.displayLocked) {
    const fp = resolveDeskProductLockFingerprint({
      ecountProdCode: existing.ecountProdCode,
      name: existing.name,
      specLabel: existing.specLabel,
      lastApiFingerprint: existing.lastApiFingerprint,
    });

    const row = await prisma.deskProduct.update({
      where: { id },
      data: {
        name,
        specLabel,
        packageUnit,
        displayLocked: true,
        lockedAtFingerprint: fp,
        needsSourceReview: false,
        curatedAt: new Date(),
        curatedByUserId: session.user.id,
      },
      select: {
        name: true,
        specLabel: true,
        packageUnit: true,
        displayLocked: true,
        needsSourceReview: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      ok: true,
      product: {
        name: row.name,
        specLabel: row.specLabel,
        packageUnit: row.packageUnit,
        displayLocked: row.displayLocked,
        needsSourceReview: row.needsSourceReview,
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  }

  const row = await prisma.deskProduct.update({
    where: { id },
    data: {
      name,
      specLabel,
      packageUnit,
      displayLocked: false,
      lockedAtFingerprint: null,
      needsSourceReview: false,
      curatedAt: null,
      curatedByUserId: null,
    },
    select: {
      name: true,
      specLabel: true,
      packageUnit: true,
      displayLocked: true,
      needsSourceReview: true,
      updatedAt: true,
    },
  });

  return res.status(200).json({
    ok: true,
    product: {
      name: row.name,
      specLabel: row.specLabel,
      packageUnit: row.packageUnit,
      displayLocked: row.displayLocked,
      needsSourceReview: row.needsSourceReview,
      updatedAt: row.updatedAt.toISOString(),
    },
  });
}
