import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { prisma } from "@/components/common/auth/server/prisma";

const CODE_MAX = 32;

function normCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, CODE_MAX);
  return t === "" ? null : t;
}

type OkBody = {
  ok: true;
  codes: {
    ecoCtgryCd: string | null;
    ecoItemCd: string | null;
    ecoVrtyCd: string | null;
    ecoGrdCd: string | null;
    ecoSggCd: string | null;
    ecoMrktCd: string | null;
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
  const keys = ["ecoCtgryCd", "ecoItemCd", "ecoVrtyCd", "ecoGrdCd", "ecoSggCd", "ecoMrktCd"] as const;
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
    ecoCtgryCd: normCode(body.ecoCtgryCd),
    ecoItemCd: normCode(body.ecoItemCd),
    ecoVrtyCd: normCode(body.ecoVrtyCd),
    ecoGrdCd: normCode(body.ecoGrdCd),
    ecoSggCd: normCode(body.ecoSggCd),
    ecoMrktCd: normCode(body.ecoMrktCd),
  };

  const row = await prisma.deskProduct.update({
    where: { id },
    data,
    select: {
      ecoCtgryCd: true,
      ecoItemCd: true,
      ecoVrtyCd: true,
      ecoGrdCd: true,
      ecoSggCd: true,
      ecoMrktCd: true,
      updatedAt: true,
    },
  });

  return res.status(200).json({
    ok: true,
    codes: {
      ecoCtgryCd: row.ecoCtgryCd,
      ecoItemCd: row.ecoItemCd,
      ecoVrtyCd: row.ecoVrtyCd,
      ecoGrdCd: row.ecoGrdCd,
      ecoSggCd: row.ecoSggCd,
      ecoMrktCd: row.ecoMrktCd,
      updatedAt: row.updatedAt.toISOString(),
    },
  });
}
