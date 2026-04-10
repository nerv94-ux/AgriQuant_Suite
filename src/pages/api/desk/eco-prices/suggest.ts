import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { callEcoPriceProductList } from "@/components/common/api/server/connectors/eco-price";
import { buildSuccess } from "@/components/common/api/server/helpers/buildResponse";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { prisma } from "@/components/common/auth/server/prisma";
import {
  extractEcoSearchKeyword,
  type EcoCodeSuggestion,
  suggestEcoCodesFromNameMatch,
} from "@/components/desk/server/ecoPriceSuggestFromName";

function parseYmd(q: string | string[] | undefined, fallback: string): string {
  const text = Array.isArray(q) ? q[0] : q;
  if (text && /^\d{8}$/.test(text.trim())) return text.trim();
  return fallback;
}

function daysAgoYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function todayYmd(): string {
  return daysAgoYmd(0);
}

export type DeskEcoSuggestResponseData = {
  keyword: string;
  suggestions: EcoCodeSuggestion[];
  rowSampleSize: number;
  hint?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<DeskEcoSuggestResponseData> | { ok: false; message: string }>,
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

  const fromDate = parseYmd(req.query.fromDate, daysAgoYmd(7));
  const toDate = parseYmd(req.query.toDate, todayYmd());

  const startedAt = performance.now();
  const requestId = crypto.randomUUID();

  const product = await prisma.deskProduct.findUnique({
    where: { id: deskProductId },
    select: { name: true, specLabel: true },
  });

  if (!product) {
    return res.status(404).json({ ok: false, message: "품목을 찾을 수 없습니다." });
  }

  const keyword = extractEcoSearchKeyword(product.name, product.specLabel ?? "");
  if (!keyword.trim()) {
    return res.status(400).json({
      ok: false,
      message: "품목명·규격에서 검색어를 만들 수 없습니다. 품목명을 한글로 입력했는지 확인해 주세요.",
    });
  }

  const all: Record<string, unknown>[] = [];

  for (let pageNo = 1; pageNo <= 3; pageNo++) {
    const result = await callEcoPriceProductList({
      requestId: `${requestId}-p${pageNo}`,
      appId: "desk-eco-suggest",
      request: {
        pageNo,
        numOfRows: 100,
        fromDate,
        toDate,
      },
    });

    if (!result.ok) {
      return res.status(502).json(result);
    }

    all.push(...result.data.items);
    if (result.data.items.length < 100) break;
  }

  const suggestions = suggestEcoCodesFromNameMatch(all, keyword, 20);
  const hint =
    suggestions.length === 0
      ? "해당 기간 샘플에 품목명이 일치하는 행이 없습니다. 기간을 넓히거나 품목명을 확인해 주세요."
      : undefined;

  const payload = buildSuccess<DeskEcoSuggestResponseData>({
    source: "ECO_PRICE",
    requestId,
    startedAt,
    data: {
      keyword,
      suggestions,
      rowSampleSize: all.length,
      hint,
    },
    message:
      suggestions.length === 0
        ? "일치하는 친환경 코드 후보가 없습니다."
        : `「${keyword}」 기준 후보 ${suggestions.length}건`,
  });

  return res.status(200).json(payload);
}
