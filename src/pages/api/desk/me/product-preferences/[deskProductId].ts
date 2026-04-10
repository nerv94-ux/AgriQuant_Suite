import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { prisma } from "@/components/common/auth/server/prisma";
import { prismaClientErrorMessage } from "@/components/common/auth/server/prismaErrors";
import { moveDeskProductToTop, setDeskProductFavorite } from "@/components/desk/server/deskProductUserPreferenceQueries";

type OkBody = { ok: true };
type ErrBody = { ok: false; message: string };

function wantsMoveToTop(raw: unknown): boolean {
  return raw === true || raw === "true";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkBody | ErrBody>) {
  if (req.method !== "PATCH" && req.method !== "POST") {
    res.setHeader("Allow", "PATCH, POST");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const userId = session.user.id;
  if (typeof userId !== "string" || userId.trim() === "") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const rawId =
    typeof req.query.deskProductId === "string"
      ? req.query.deskProductId
      : Array.isArray(req.query.deskProductId)
        ? req.query.deskProductId[0]
        : "";
  const deskProductId = rawId?.trim() ?? "";
  if (!deskProductId) {
    return res.status(400).json({ ok: false, message: "MISSING_ID" });
  }

  const body = (req.body ?? {}) as {
    favorite?: unknown;
    moveToTop?: unknown;
  };

  try {
    const exists = await prisma.deskProduct.findUnique({ where: { id: deskProductId }, select: { id: true } });
    if (!exists) {
      return res.status(404).json({ ok: false, message: "품목을 찾을 수 없습니다." });
    }

    if (wantsMoveToTop(body.moveToTop)) {
      await moveDeskProductToTop(userId, deskProductId);
      return res.status(200).json({ ok: true });
    }

    let changed = false;
    if (body.favorite !== undefined) {
      if (typeof body.favorite !== "boolean") {
        return res.status(400).json({ ok: false, message: "favorite는 boolean 이어야 합니다." });
      }
      await setDeskProductFavorite(userId, deskProductId, body.favorite);
      changed = true;
    }
    if (!changed) {
      return res.status(400).json({
        ok: false,
        message: "favorite 또는 moveToTop 을 보내 주세요.",
      });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[desk/me/product-preferences]", deskProductId, e);
    const hint = prismaClientErrorMessage(e);
    return res.status(500).json({
      ok: false,
      message: hint ?? "설정을 저장하지 못했습니다.",
    });
  }
}
