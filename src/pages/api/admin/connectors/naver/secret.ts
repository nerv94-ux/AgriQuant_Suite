import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { ApiErrorCategory } from "@/components/common/api/server/contracts";
import { buildError, buildSuccess } from "@/components/common/api/server/helpers/buildResponse";
import {
  getNaverSettingsOverview,
  saveNaverSecret,
  type NaverSettingsOverview,
} from "@/components/common/api/server/admin/providerSettings";

type SecretBody = {
  clientId?: string;
  clientSecret?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<NaverSettingsOverview>>
) {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const session = await getServerSession(req, res, authOptions);

  if (req.method !== "POST") {
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

  const body = (req.body ?? {}) as SecretBody;
  const clientId = body.clientId?.trim();
  const clientSecret = body.clientSecret?.trim();

  if (!clientId || !clientSecret) {
    return res.status(400).json(
      buildError({
        message: "NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 모두 입력해 주세요.",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      })
    );
  }

  await saveNaverSecret({
    clientId,
    clientSecret,
    updatedByEmail: session.user.email ?? null,
  });

  const data = await getNaverSettingsOverview();
  return res.status(200).json(buildSuccess({ data, source: "SYSTEM", requestId, startedAt }));
}
