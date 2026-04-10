import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { fetchMafraAgricnsmTrnd } from "@/components/common/api/server/connectors/mafra-agricnsm-trnd";
import type { MafraAgricnsmTrndResponseData } from "@/components/common/api/server/connectors/mafra-agricnsm-trnd";

function parseNumberOrUndefined(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraAgricnsmTrndResponseData> | { ok: false; message: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const year = String(req.query.CRTR_YEAR ?? req.query.crtrYear ?? "").trim();
  const month = String(req.query.CRTR_MONTH ?? req.query.crtrMonth ?? "").trim();
  const startIndex = parseNumberOrUndefined(req.query.startIndex);
  const endIndex = parseNumberOrUndefined(req.query.endIndex);
  const fetchAll = String(req.query.fetchAll ?? "0") === "1";
  const latestWindow = String(req.query.latestWindow ?? "1") !== "0";
  const windowSize = Math.max(100, Math.min(3000, parseNumberOrUndefined(req.query.windowSize) ?? 1200));

  let result = await fetchMafraAgricnsmTrnd({
    requestId: crypto.randomUUID(),
    appId: "desk-mafra-agricnsm-trnd-list",
    request: {
      CRTR_YEAR: year,
      CRTR_MONTH: month,
      startIndex,
      endIndex,
    },
  });

  if (fetchAll && result.ok && result.data) {
    const merged = [...result.data.rows];
    const total = result.data.totalCount;
    const CAP = 12000;
    let nextStart = merged.length + 1;
    while (nextStart <= total && merged.length < CAP) {
      const nextEnd = Math.min(nextStart + 999, total, CAP);
      const next = await fetchMafraAgricnsmTrnd({
        requestId: crypto.randomUUID(),
        appId: "desk-mafra-agricnsm-trnd-list-fetch-all",
        request: {
          CRTR_YEAR: year,
          CRTR_MONTH: month,
          startIndex: nextStart,
          endIndex: nextEnd,
        },
      });
      if (!next.ok || !next.data) break;
      if (next.data.rows.length === 0) break;
      merged.push(...next.data.rows);
      nextStart = nextEnd + 1;
    }
    result = {
      ...result,
      message: `${result.message} (전체 조회 ${merged.length}건)`,
      data: {
        ...result.data,
        startIndex: 1,
        endIndex: merged.length,
        rows: merged,
      },
    };
  }

  // 연/월 지정이 없을 때는 최신 구간을 다시 요청해 과거 데이터 편향을 줄인다.
  if (
    !fetchAll &&
    latestWindow &&
    !year &&
    !month &&
    result.ok &&
    result.data &&
    result.data.totalCount > result.data.rows.length
  ) {
    const total = result.data.totalCount;
    const lastStart = Math.max(1, total - windowSize + 1);
    const lastEnd = total;
    const retry = await fetchMafraAgricnsmTrnd({
      requestId: crypto.randomUUID(),
      appId: "desk-mafra-agricnsm-trnd-list-latest-window",
      request: {
        startIndex: lastStart,
        endIndex: lastEnd,
      },
    });
    if (retry.ok && retry.data) {
      const mergeMessage = `${retry.message} (최신 구간 ${lastStart}-${lastEnd}/${total})`;
      result = { ...retry, message: mergeMessage };
    }
  }

  return res.status(result.ok ? 200 : 502).json(result);
}

