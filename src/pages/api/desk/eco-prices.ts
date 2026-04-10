import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { callEcoPriceProductList } from "@/components/common/api/server/connectors/eco-price";
import type { EcoPriceProductListResponseData } from "@/components/common/api/server/connectors/eco-price";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { prisma } from "@/components/common/auth/server/prisma";
import { filterEcoPriceItemsByResolved } from "@/components/desk/server/filterEcoPriceItems";
import { resolveEcoPriceCodes } from "@/components/desk/server/ecoPriceDeskCodes";
import type { EcoPriceResolvedCodes } from "@/components/desk/server/ecoPriceDeskCodes";

export type DeskEcoPricesResponseData = EcoPriceProductListResponseData & {
  resolved: EcoPriceResolvedCodes;
  /** 첫 조회 0건일 때 품종(vrty)만 생략하고 재조회한 경우(부류·품목은 유지) */
  usedRelaxedInference?: boolean;
};

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    ApiResponse<DeskEcoPricesResponseData> | { ok: false; message: string; detail?: string }
  >,
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

  let pageNo = 1;
  let numOfRows = 50;
  const pn = Number(Array.isArray(req.query.pageNo) ? req.query.pageNo[0] : req.query.pageNo);
  const nr = Number(Array.isArray(req.query.numOfRows) ? req.query.numOfRows[0] : req.query.numOfRows);
  if (Number.isFinite(pn) && pn > 0) pageNo = Math.floor(pn);
  if (Number.isFinite(nr) && nr > 0) numOfRows = Math.min(100, Math.floor(nr));

  const row = await prisma.deskProduct.findUnique({
    where: { id: deskProductId },
    select: {
      ecoCtgryCd: true,
      ecoItemCd: true,
      ecoVrtyCd: true,
      ecoGrdCd: true,
      ecoSggCd: true,
      ecoMrktCd: true,
      mafraLarge: true,
      mafraMid: true,
      mafraSmall: true,
    },
  });

  if (!row) {
    return res.status(404).json({ ok: false, message: "품목을 찾을 수 없습니다." });
  }

  /** 쿼리에 eco*가 있으면(빈 문자열 포함) 그때그때 폼 값으로 조회 — 저장 없이 시험 가능 */
  const pick = (key: string, fallback: string | null): string | null => {
    if (!(key in req.query)) return fallback;
    const raw = Array.isArray(req.query[key]) ? req.query[key][0] : req.query[key];
    const v = String(raw ?? "").trim().slice(0, 32);
    return v === "" ? null : v;
  };

  const merged = {
    ...row,
    ecoCtgryCd: pick("ecoCtgryCd", row.ecoCtgryCd),
    ecoItemCd: pick("ecoItemCd", row.ecoItemCd),
    ecoVrtyCd: pick("ecoVrtyCd", row.ecoVrtyCd),
    ecoGrdCd: pick("ecoGrdCd", row.ecoGrdCd),
    ecoSggCd: pick("ecoSggCd", row.ecoSggCd),
    ecoMrktCd: pick("ecoMrktCd", row.ecoMrktCd),
  };

  const resolved = resolveEcoPriceCodes(merged);

  if (resolved.source === "empty") {
    const needCore = resolved.detail === "need_ctgry_item";
    return res.status(400).json({
      ok: false,
      detail: needCore ? "need_ctgry_item" : undefined,
      message: needCore
        ? "친환경 가격 조회에는 부류·품목 코드가 둘 다 필요합니다. MAFRA 대·중을 각각 숫자 3자리로 저장했는지 확인하거나, 아래 친환경 부류·품목을 직접 입력하세요. (소(품종)만으로는 조회할 수 없으며, 품종 코드가 여러 품목에서 겹칩니다.)"
        : "친환경 조회에 쓸 코드가 없습니다. 위에서 MAFRA 대·중·소를 저장하거나 친환경 코드를 입력해 주세요.",
    });
  }

  const callList = (codes: {
    ctgryCd?: string;
    itemCd?: string;
    vrtyCd?: string;
    grdCd?: string;
    sggCd?: string;
    mrktCd?: string;
  }) =>
    callEcoPriceProductList({
      requestId: crypto.randomUUID(),
      appId: "desk-eco-prices",
      request: {
        pageNo,
        numOfRows,
        fromDate,
        toDate,
        ...codes,
      },
    });

  let result = await callList({
    ctgryCd: resolved.ctgryCd ?? undefined,
    itemCd: resolved.itemCd ?? undefined,
    vrtyCd: resolved.vrtyCd ?? undefined,
    grdCd: resolved.grdCd ?? undefined,
    sggCd: resolved.sggCd ?? undefined,
    mrktCd: resolved.mrktCd ?? undefined,
  });
  let usedRelaxedInference = false;

  /**
   * 추정 코드로 0건일 때만, 부류·품목은 유지한 채 품종(vrty) 조건만 한 번 제거해 재조회.
   * (이전 구현: 부류·품목·품종을 모두 빼서 기간 전체 품목이 섞여 나오는 문제가 있었음)
   */
  if (
    result.ok &&
    result.data.items.length === 0 &&
    resolved.source === "inferred" &&
    resolved.ctgryCd &&
    resolved.itemCd &&
    resolved.vrtyCd
  ) {
    const retry = await callList({
      ctgryCd: resolved.ctgryCd,
      itemCd: resolved.itemCd,
      grdCd: resolved.grdCd ?? undefined,
      sggCd: resolved.sggCd ?? undefined,
      mrktCd: resolved.mrktCd ?? undefined,
    });
    if (retry.ok && retry.data.items.length > 0) {
      result = retry;
      usedRelaxedInference = true;
    }
  }

  if (!result.ok) {
    return res.status(502).json(result);
  }

  /** cond 폴백 등으로 섞인 행 제거 + 품종 생략 재조회 시에는 부류·품목만 일치시킴 */
  const itemsFiltered = filterEcoPriceItemsByResolved(
    result.data.items as Record<string, unknown>[],
    resolved,
    { matchVrty: !usedRelaxedInference },
  );

  const payload: ApiResponse<DeskEcoPricesResponseData> = {
    ...result,
    data: {
      ...result.data,
      items: itemsFiltered,
      totalCount: itemsFiltered.length,
      resolved,
      usedRelaxedInference,
    },
  };
  return res.status(200).json(payload);
}
