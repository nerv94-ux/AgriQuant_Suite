import { prisma } from "@/components/common/auth/server/prisma";

const MAX_LOGS_PER_SOURCE = 500;
const MAX_LOG_AGE_DAYS = 30;

export async function trimApiLogs(source: string): Promise<void> {
  const cutoff = new Date(Date.now() - MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000);

  await prisma.apiCallLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
    },
  });

  const staleRows = await prisma.apiCallLog.findMany({
    where: { source },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: MAX_LOGS_PER_SOURCE,
    select: { id: true },
  });

  if (staleRows.length === 0) {
    return;
  }

  await prisma.apiCallLog.deleteMany({
    where: {
      id: {
        in: staleRows.map((row) => row.id),
      },
    },
  });
}
