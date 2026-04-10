import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { callNaverSearch } from "@/components/common/api/server/connectors/naver";
import type { NaverSearchResponseData } from "@/components/common/api/server/connectors/naver";

function parseNumberOrUndefined(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<NaverSearchResponseData> | { ok: false; message: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const query = String(req.query.query ?? "").trim();
  if (!query) {
    return res.status(400).json({ ok: false, message: "query가 필요합니다." });
  }

  const sortRaw = String(req.query.sort ?? "sim").trim().toLowerCase();
  const sort: "sim" | "date" = sortRaw === "date" ? "date" : "sim";

  const result = await callNaverSearch({
    requestId: crypto.randomUUID(),
    appId: "desk-naver-search",
    query,
    sort,
    display: parseNumberOrUndefined(req.query.display),
    start: parseNumberOrUndefined(req.query.start),
  });

  return res.status(result.ok ? 200 : 502).json(result);
}

