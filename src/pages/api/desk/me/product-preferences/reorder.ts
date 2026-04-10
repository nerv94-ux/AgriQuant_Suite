import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { prisma } from "@/components/common/auth/server/prisma";
import { prismaClientErrorMessage } from "@/components/common/auth/server/prismaErrors";
import { upsertDeskProductOrderForUser } from "@/components/desk/server/deskProductUserPreferenceQueries";

type OkBody = { ok: true };
type ErrBody = { ok: false; message: string };

const MAX_ITEMS = 2000;

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkBody | ErrBody>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const body = (req.body ?? {}) as {
    items?: unknown;
  };
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ ok: false, message: "items 배열이 필요합니다." });
  }
  if (body.items.length > MAX_ITEMS) {
    return res.status(400).json({ ok: false, message: `한 번에 최대 ${MAX_ITEMS}건까지 정렬할 수 있습니다.` });
  }

  const items: { deskProductId: string; favorite: boolean }[] = [];
  const seen = new Set<string>();
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return res.status(400).json({ ok: false, message: "items 항목 형식이 올바르지 않습니다." });
    }
    const o = raw as Record<string, unknown>;
    const id = typeof o.deskProductId === "string" ? o.deskProductId.trim() : "";
    if (!id) {
      return res.status(400).json({ ok: false, message: "deskProductId가 필요합니다." });
    }
    if (seen.has(id)) {
      return res.status(400).json({ ok: false, message: "중복된 품목이 있습니다." });
    }
    seen.add(id);
    if (typeof o.favorite !== "boolean") {
      return res.status(400).json({ ok: false, message: "favorite(boolean)이 필요합니다." });
    }
    items.push({ deskProductId: id, favorite: o.favorite });
  }

  const existing = await prisma.deskProduct.findMany({
    where: { id: { in: items.map((i) => i.deskProductId) } },
    select: { id: true },
  });
  if (existing.length !== items.length) {
    return res.status(400).json({ ok: false, message: "존재하지 않는 품목이 포함되어 있습니다." });
  }

  try {
    await upsertDeskProductOrderForUser(session.user.id, items);
  } catch (e) {
    console.error(e);
    const hint = prismaClientErrorMessage(e);
    return res.status(500).json({ ok: false, message: hint ?? "순서 저장에 실패했습니다." });
  }

  return res.status(200).json({ ok: true });
}
