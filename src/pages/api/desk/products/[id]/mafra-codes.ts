import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { prisma } from "@/components/common/auth/server/prisma";

const CODE_MAX = 64;

function normCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, CODE_MAX);
  return t === "" ? null : t;
}

type OkBody = {
  ok: true;
  codes: {
    mafraLarge: string | null;
    mafraMid: string | null;
    mafraSmall: string | null;
    mafraUnitCodeId: string | null;
    mafraGrdCodeId: string | null;
    mafraFrmlCodeId: string | null;
    updatedAt: string;
  };
};
type ErrBody = { ok: false; message: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkBody | ErrBody>) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
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

  const body = (req.body ?? {}) as Record<string, unknown>;
  const keys = [
    "mafraLarge",
    "mafraMid",
    "mafraSmall",
    "mafraUnitCodeId",
    "mafraGrdCodeId",
    "mafraFrmlCodeId",
  ] as const;
  for (const k of keys) {
    if (typeof body[k] !== "string") {
      return res.status(400).json({
        ok: false,
        message: `${keys.join(", ")} 는 각각 string(빈 문자열로 비움)이어야 합니다.`,
      });
    }
  }

  const existing = await prisma.deskProduct.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return res.status(404).json({ ok: false, message: "NOT_FOUND" });
  }

  const data = {
    mafraLarge: normCode(body.mafraLarge),
    mafraMid: normCode(body.mafraMid),
    mafraSmall: normCode(body.mafraSmall),
    mafraUnitCodeId: normCode(body.mafraUnitCodeId),
    mafraGrdCodeId: normCode(body.mafraGrdCodeId),
    mafraFrmlCodeId: normCode(body.mafraFrmlCodeId),
  };

  const row = await prisma.deskProduct.update({
    where: { id },
    data,
    select: {
      mafraLarge: true,
      mafraMid: true,
      mafraSmall: true,
      mafraUnitCodeId: true,
      mafraGrdCodeId: true,
      mafraFrmlCodeId: true,
      updatedAt: true,
    },
  });

  return res.status(200).json({
    ok: true,
    codes: {
      mafraLarge: row.mafraLarge,
      mafraMid: row.mafraMid,
      mafraSmall: row.mafraSmall,
      mafraUnitCodeId: row.mafraUnitCodeId,
      mafraGrdCodeId: row.mafraGrdCodeId,
      mafraFrmlCodeId: row.mafraFrmlCodeId,
      updatedAt: row.updatedAt.toISOString(),
    },
  });
}
