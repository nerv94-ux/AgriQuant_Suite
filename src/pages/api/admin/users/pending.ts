import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { prisma } from "@/components/common/auth/server/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "ADMIN" || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const appIdQuery = req.query.appId;
  const appId =
    typeof appIdQuery === "string" && appIdQuery.trim().length > 0
      ? appIdQuery.trim()
      : undefined;

  const pendingUsers = await prisma.user.findMany({
    where: appId ? { approvalStatus: "PENDING", registeredAppId: appId } : { approvalStatus: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      registeredAppId: true,
      createdAt: true,
    },
  });

  return res.status(200).json({ pendingUsers });
}

