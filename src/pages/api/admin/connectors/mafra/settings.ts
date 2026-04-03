import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { ApiErrorCategory } from "@/components/common/api/server/contracts";
import { buildError, buildSuccess } from "@/components/common/api/server/helpers/buildResponse";
import { getMafraApiKey } from "@/components/common/api/server/admin/mafraItemCodeStore";

type MafraSecretOverview = {
  configured: boolean;
  source: "DB" | "ENV" | "NONE";
};

async function getOverview(): Promise<MafraSecretOverview> {
  const key = await getMafraApiKey();
  if (!key) {
    return { configured: false, source: "NONE" };
  }
  if (process.env.MAFRA_API_KEY?.trim() && key === process.env.MAFRA_API_KEY.trim()) {
    return { configured: true, source: "ENV" };
  }
  return { configured: true, source: "DB" };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraSecretOverview>>
) {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const session = await getServerSession(req, res, authOptions);

  if (req.method !== "GET") {
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

  const data = await getOverview();
  return res.status(200).json(buildSuccess({ data, source: "SYSTEM", requestId, startedAt }));
}
