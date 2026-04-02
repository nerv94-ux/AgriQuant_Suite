import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { ApiErrorCategory } from "@/components/common/api/server/contracts";
import { buildError, buildSuccess } from "@/components/common/api/server/helpers/buildResponse";
import {
  getKmaSettingsOverview,
  saveKmaConfig,
  type KmaSettingsOverview,
} from "@/components/common/api/server/admin/providerSettings";

type SettingsBody = {
  enabled?: boolean;
  nx?: number;
  ny?: number;
  baseTime?: string;
  pageNo?: number;
  numOfRows?: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<KmaSettingsOverview>>
) {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "ADMIN" || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json(
      buildError({
        message: "FORBIDDEN",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.AUTH_ERROR,
      })
    );
  }

  if (req.method === "GET") {
    const data = await getKmaSettingsOverview();
    return res.status(200).json(buildSuccess({ data, source: "SYSTEM", requestId, startedAt }));
  }

  if (req.method !== "PATCH") {
    return res.status(405).json(
      buildError({
        message: "METHOD_NOT_ALLOWED",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      })
    );
  }

  const body = (req.body ?? {}) as SettingsBody;
  const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
  const nx = Number(body.nx);
  const ny = Number(body.ny);
  const pageNo = Number(body.pageNo);
  const numOfRows = Number(body.numOfRows);
  const baseTime = typeof body.baseTime === "string" ? body.baseTime.trim() : "";

  if (
    !Number.isInteger(nx) ||
    !Number.isInteger(ny) ||
    !Number.isInteger(pageNo) ||
    !Number.isInteger(numOfRows) ||
    !/^\d{4}$/.test(baseTime)
  ) {
    return res.status(400).json(
      buildError({
        message: "설정값 형식이 올바르지 않습니다. (nx, ny, pageNo, numOfRows, baseTime=HHmm)",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      })
    );
  }

  await saveKmaConfig({
    enabled,
    nx,
    ny,
    baseTime,
    pageNo,
    numOfRows,
    updatedByEmail: session.user.email ?? null,
  });

  const data = await getKmaSettingsOverview();
  return res.status(200).json(buildSuccess({ data, source: "SYSTEM", requestId, startedAt }));
}
