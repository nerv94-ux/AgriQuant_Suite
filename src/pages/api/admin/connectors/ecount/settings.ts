import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { ApiErrorCategory } from "@/components/common/api/server/contracts";
import { buildError, buildSuccess } from "@/components/common/api/server/helpers/buildResponse";
import {
  getEcountSettingsOverview,
  saveEcountConfig,
  type EcountSettingsOverview,
} from "@/components/common/api/server/admin/providerSettings";

type SettingsBody = {
  enabled?: boolean;
  comCode?: string;
  userId?: string;
  zone?: string;
  lanType?: string;
  envMode?: "test" | "prod";
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<EcountSettingsOverview>>
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
    const data = await getEcountSettingsOverview();
    return res
      .status(200)
      .json(buildSuccess({ data, source: "SYSTEM", requestId, startedAt }));
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
  const envMode = body.envMode === "prod" ? "prod" : "test";
  const comCode = typeof body.comCode === "string" ? body.comCode.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const zone = typeof body.zone === "string" ? body.zone.trim().toUpperCase() : "";
  const lanType = typeof body.lanType === "string" && body.lanType.trim() ? body.lanType.trim() : "ko-KR";

  if (comCode.length > 0 && !/^\d{1,6}$/.test(comCode)) {
    return res.status(400).json(
      buildError({
        message: "COM_CODE는 숫자 최대 6자리 형식이어야 합니다.",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      })
    );
  }

  if (zone.length > 0 && zone.length > 2) {
    return res.status(400).json(
      buildError({
        message: "ZONE은 최대 2자리로 입력해 주세요.",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      })
    );
  }

  await saveEcountConfig({
    enabled,
    comCode,
    userId,
    zone,
    lanType,
    envMode,
    updatedByEmail: session.user.email ?? null,
  });

  const data = await getEcountSettingsOverview();
  return res
    .status(200)
    .json(buildSuccess({ data, source: "SYSTEM", requestId, startedAt }));
}
