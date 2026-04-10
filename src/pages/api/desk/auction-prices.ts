import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { authOptions } from "@/components/common/auth/server/authOptions";
import {
  DEFAULT_DESK_AUCTION_MAX_MARKETS,
  fetchDeskAuctionPriceSheet,
} from "@/components/desk/server/deskAuctionPriceSheet";
import type { DeskAuctionPriceSheetData } from "@/types/deskAuctionPriceSheet";

function parsePositiveInt(q: string | string[] | undefined, fallback: number) {
  const text = Array.isArray(q) ? q[0] : q;
  if (!text) return fallback;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<DeskAuctionPriceSheetData> | { ok: false; message: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const deskProductId = String(req.query.deskProductId ?? "").trim();
  if (!deskProductId) {
    return res.status(400).json({ ok: false, message: "deskProductId가 필요합니다." });
  }

  const saleDate = String(req.query.saleDate ?? "").trim();
  if (!/^\d{8}$/.test(saleDate)) {
    return res.status(400).json({ ok: false, message: "saleDate는 YYYYMMDD 형식이어야 합니다." });
  }

  const maxMarkets = parsePositiveInt(req.query.maxMarkets, DEFAULT_DESK_AUCTION_MAX_MARKETS);

  const result = await fetchDeskAuctionPriceSheet({
    requestId: crypto.randomUUID(),
    deskProductId,
    saleDate,
    maxMarkets,
  });

  if (result.ok) {
    return res.status(200).json(result);
  }

  const msg = result.message ?? "";
  if (msg.includes("품목을 찾을 수 없")) {
    return res.status(404).json(result);
  }
  if (msg.includes("소(SMALL)") || msg.includes("YYYYMMDD")) {
    return res.status(400).json(result);
  }
  return res.status(502).json(result);
}
