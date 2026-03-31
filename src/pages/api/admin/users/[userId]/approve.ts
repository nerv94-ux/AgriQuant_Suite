import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { prisma } from "@/components/common/auth/server/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "ADMIN" || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const { userId } = req.query;
  if (typeof userId !== "string" || !userId) {
    return res.status(400).json({ error: "INVALID_USER_ID" });
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        approvalStatus: "APPROVED",
      },
    });

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(404).json({ error: "USER_NOT_FOUND" });
  }
}

