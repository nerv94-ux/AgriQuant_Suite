import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { prisma } from "@/components/common/auth/server/prisma";

const MAX_IDS = 500;

type OkBody = { ok: true; updated: number };
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

  const body = (req.body ?? {}) as { ids?: unknown; enabled?: unknown };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return res.status(400).json({ ok: false, message: "ids(문자열 배열)이 필요합니다." });
  }
  if (typeof body.enabled !== "boolean") {
    return res.status(400).json({ ok: false, message: "enabled(boolean)이 필요합니다." });
  }

  const ids = body.ids.filter((x): x is string => typeof x === "string" && x.length > 0);
  if (ids.length === 0) {
    return res.status(400).json({ ok: false, message: "유효한 id가 없습니다." });
  }
  if (ids.length > MAX_IDS) {
    return res.status(400).json({ ok: false, message: `한 번에 최대 ${MAX_IDS}건까지 가능합니다.` });
  }

  const unique = [...new Set(ids)];
  const result = await prisma.deskProduct.updateMany({
    where: { id: { in: unique } },
    data: { deskEnabled: body.enabled },
  });

  return res.status(200).json({ ok: true, updated: result.count });
}
