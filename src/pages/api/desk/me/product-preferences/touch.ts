import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { prisma } from "@/components/common/auth/server/prisma";
import { touchDeskProductLastUsed } from "@/components/desk/server/deskProductUserPreferenceQueries";

type OkBody = { ok: true };
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

  const body = (req.body ?? {}) as { deskProductId?: unknown };
  const deskProductId = typeof body.deskProductId === "string" ? body.deskProductId.trim() : "";
  if (!deskProductId) {
    return res.status(400).json({ ok: false, message: "deskProductId가 필요합니다." });
  }

  const exists = await prisma.deskProduct.findUnique({ where: { id: deskProductId }, select: { id: true } });
  if (!exists) {
    return res.status(404).json({ ok: false, message: "품목을 찾을 수 없습니다." });
  }

  await touchDeskProductLastUsed(session.user.id, deskProductId);
  return res.status(200).json({ ok: true });
}
