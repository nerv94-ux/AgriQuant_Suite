import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { syncDeskProductsFromEcount } from "@/components/desk/server/syncDeskProductsFromEcount";

type OkBody = {
  ok: true;
  message: string;
  upserted: number;
};

type ErrBody = {
  ok: false;
  message: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkBody | ErrBody>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  try {
    const result = await syncDeskProductsFromEcount();
    if (!result.ok) {
      return res.status(502).json({ ok: false, message: result.message });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      upserted: result.upserted,
    });
  } catch (e) {
    console.error("[api/desk/ecount/sync]", e);
    const msg = e instanceof Error ? e.message : "동기화 중 서버 오류가 났습니다.";
    return res.status(500).json({ ok: false, message: msg });
  }
}
