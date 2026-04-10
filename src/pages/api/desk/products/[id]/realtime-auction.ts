import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { fetchMafraRealtimeAuctionInfo } from "@/components/common/api/server/connectors/mafra-rltm-auc-info";
import type { MafraRealtimeAuctionResponseData } from "@/components/common/api/server/connectors/mafra-rltm-auc-info";
import { deskProductPrimaryItemQueryForMafra } from "@/components/desk/server/deskProductMafraItemQuery";
import { filterRealtimeAuctionRowsByDeskItem } from "@/components/desk/server/filterMafraRealtimeRowsByItem";
import { getDeskProductById } from "@/components/desk/server/deskProductQueries";

function parsePositiveInt(q: string | string[] | undefined, fallback: number) {
  const text = Array.isArray(q) ? q[0] : q;
  if (!text) return fallback;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraRealtimeAuctionResponseData> | { ok: false; message: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const rawId = req.query.id;
  const id = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";
  if (!id) {
    return res.status(400).json({ ok: false, message: "MISSING_ID" });
  }

  const product = await getDeskProductById(id);
  if (!product) {
    return res.status(404).json({ ok: false, message: "NOT_FOUND" });
  }

  const saleDate = String(req.query.saleDate ?? "").trim();
  if (!/^\d{8}$/.test(saleDate)) {
    return res.status(400).json({ ok: false, message: "saleDate는 YYYYMMDD 형식이어야 합니다." });
  }

  const whsalName = String(req.query.whsalName ?? "").trim() || "서울가락";
  const cmpName = String(req.query.cmpName ?? "").trim() || "한국청과";
  const whsalcd = String(req.query.whsalcd ?? "").trim();
  const cmpcd = String(req.query.cmpcd ?? "").trim();
  const startIndex = parsePositiveInt(req.query.startIndex, 1);
  const endIndex = Math.max(startIndex, parsePositiveInt(req.query.endIndex, 50));
  const autoResolve = String(req.query.autoResolve ?? "1") !== "0";

  const L = product.mafraLarge?.trim() ?? "";
  const M = product.mafraMid?.trim() ?? "";
  const S = product.mafraSmall?.trim() ?? "";
  const hasDbSmall = Boolean(S);
  /** 짧은 SMALL만 있으면 API가 넓게 줄 수 있어, 대·중·소가 모두 있을 때만 API에 세그먼트를 함께 넣음. */
  const hasFullTriplet = Boolean(L && M && S);

  const result = await fetchMafraRealtimeAuctionInfo({
    requestId: crypto.randomUUID(),
    appId: "desk-realtime-auction",
    request: {
      saleDate,
      whsalcd: whsalcd || undefined,
      cmpcd: cmpcd || undefined,
      large: hasDbSmall ? (hasFullTriplet ? L : "") : product.mafraLarge ?? "",
      mid: hasDbSmall ? (hasFullTriplet ? M : "") : product.mafraMid ?? "",
      small: product.mafraSmall ?? "",
      deskStrictItem: hasDbSmall
        ? { small: S, ...(L ? { large: L } : {}), ...(M ? { mid: M } : {}) }
        : undefined,
      whsalName,
      cmpName,
      /** SMALL이 DB에 있으면 코드사전 품목 해석에 의존하지 않음. 없으면 품목명·규격·포장 조합으로 매칭 */
      itemName: product.mafraSmall?.trim() ? "" : deskProductPrimaryItemQueryForMafra(product),
      startIndex,
      endIndex,
      autoResolveCodes: autoResolve,
      preferGarakItemCode: String(req.query.preferGarakItemCode ?? "") === "1",
      deskItemMatch: true,
    },
  });

  if (!result.ok || !result.data) {
    return res.status(502).json(result);
  }

  const expectedSmall = product.mafraSmall?.trim() || result.data.resolved.small?.trim() || "";
  if (!expectedSmall) {
    const msg =
      "품목 소(SMALL) 코드를 확정할 수 없어 경매 행을 표시하지 않습니다. 상세에서 「시세용 농식품 품목 확정」 또는 「시세·가격비교용 코드」에서 품목을 저장해 주세요.";
    return res.status(200).json({
      ...result,
      message: msg,
      data: {
        ...result.data,
        rows: [],
        totalCount: 0,
      },
    });
  }

  const before = result.data.rows.length;
  const filtered = filterRealtimeAuctionRowsByDeskItem(result.data.rows, {
    small: expectedSmall,
    large: product.mafraLarge,
    mid: product.mafraMid,
  });
  const dropped = before - filtered.length;
  const message =
    dropped > 0
      ? `${result.message} (저장·해석 품목과 불일치 ${dropped}건 제외)`
      : result.message;

  return res.status(200).json({
    ...result,
    message,
    data: {
      ...result.data,
      rows: filtered,
      totalCount: filtered.length,
    },
  });
}
