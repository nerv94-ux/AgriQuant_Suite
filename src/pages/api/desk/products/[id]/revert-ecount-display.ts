import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callEcountGetBasicProductsList } from "@/components/common/api/server/connectors/ecount";
import {
  computeDeskProductApiFingerprint,
  deskSyncDisplayFromEcountApi,
  pickEcountDeskNameFromRaw,
  pickEcountDeskSpecFromRaw,
} from "@/components/desk/server/ecountDeskDisplay";
import { prisma } from "@/components/common/auth/server/prisma";
import { DeskProductSource } from "@prisma/client";

type OkBody = {
  ok: true;
  product: {
    name: string;
    specLabel: string;
    packageUnit: string;
    displayLocked: boolean;
    needsSourceReview: boolean;
    updatedAt: string;
  };
};
type ErrBody = { ok: false; message: string };

/**
 * 동기화와 동일하게 **GetBasicProductsList**에 `PROD_CD`만 넣어 한 건만 조회합니다.
 * (`ViewBasicProduct`는 OpenAPI에서 별도 허용이 없으면 “인증되지 않은 API”로 거절되는 경우가 많음)
 * 받은 행으로 동일 규칙(`deskSyncDisplayFromEcountApi`) 적용. DB 원문 컬럼은 쓰지 않음.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<OkBody | ErrBody>) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : Array.isArray(req.query.id) ? req.query.id[0] : "";
  if (!id) {
    return res.status(400).json({ ok: false, message: "MISSING_ID" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const existing = await prisma.deskProduct.findUnique({
    where: { id },
    select: {
      id: true,
      source: true,
      ecountProdCode: true,
    },
  });

  if (!existing) {
    return res.status(404).json({ ok: false, message: "NOT_FOUND" });
  }

  if (existing.source !== DeskProductSource.ECOUNT) {
    return res.status(400).json({ ok: false, message: "이카운트 품목만 되돌릴 수 있습니다." });
  }

  const code = existing.ecountProdCode?.trim() ?? "";
  if (!code) {
    return res.status(400).json({ ok: false, message: "품목코드가 없어 이카운트 조회를 할 수 없습니다." });
  }

  const api = await callEcountGetBasicProductsList({
    requestId: crypto.randomUUID(),
    appId: "desk-revert-ecount-display",
    request: { prodCode: code },
    timeoutMs: 60_000,
  });

  if (!api.ok) {
    return res.status(502).json({
      ok: false,
      message: api.message ?? "이카운트 품목 조회에 실패했습니다.",
    });
  }

  const rows = api.data.products ?? [];
  const raw =
    rows.find((r) => String((r as Record<string, unknown>).PROD_CD ?? "").trim() === code) ??
    (rows.length === 1 ? rows[0] : undefined);

  if (!raw || typeof raw !== "object") {
    return res.status(502).json({
      ok: false,
      message:
        rows.length === 0
          ? `이카운트 품목 목록 조회 결과가 0건입니다. (PROD_CD: ${code})`
          : "응답에서 해당 품목코드 행을 찾지 못했습니다.",
    });
  }
  const fullName = pickEcountDeskNameFromRaw(raw, code);
  const apiSpec = pickEcountDeskSpecFromRaw(raw);
  const fp = computeDeskProductApiFingerprint(code, fullName, apiSpec);
  const { name, specLabel } = deskSyncDisplayFromEcountApi(fullName, code);

  const row = await prisma.deskProduct.update({
    where: { id },
    data: {
      name,
      specLabel,
      packageUnit: "",
      displayLocked: false,
      lockedAtFingerprint: null,
      lastApiFingerprint: fp,
      needsSourceReview: false,
      curatedAt: null,
      curatedByUserId: null,
    },
    select: {
      name: true,
      specLabel: true,
      packageUnit: true,
      displayLocked: true,
      needsSourceReview: true,
      updatedAt: true,
    },
  });

  return res.status(200).json({
    ok: true,
    product: {
      name: row.name,
      specLabel: row.specLabel,
      packageUnit: row.packageUnit,
      displayLocked: row.displayLocked,
      needsSourceReview: row.needsSourceReview,
      updatedAt: row.updatedAt.toISOString(),
    },
  });
}
