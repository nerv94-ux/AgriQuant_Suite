import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import {
  getDeskProductUserDraft,
  upsertDeskProductUserDraft,
} from "@/components/desk/server/deskUserDraftQueries";

type OkGet = { ok: true; draft: { targetPriceWon: string; note: string; updatedAt: string } | null };
type OkPut = { ok: true; draft: { targetPriceWon: string; note: string; updatedAt: string } };
type ErrBody = { ok: false; message: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkGet | OkPut | ErrBody>) {
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
    const draft = await getDeskProductUserDraft(userId, id);
    return res.status(200).json({ ok: true, draft });
  }

  if (req.method === "PUT") {
    const body = (req.body ?? {}) as { targetPriceWon?: unknown; note?: unknown };
    if (typeof body.targetPriceWon !== "string" || typeof body.note !== "string") {
      return res.status(400).json({ ok: false, message: "targetPriceWon(string), note(string)이 필요합니다." });
    }
    const draft = await upsertDeskProductUserDraft(userId, id, {
      targetPriceWon: body.targetPriceWon,
      note: body.note,
    });
    return res.status(200).json({ ok: true, draft });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
}
