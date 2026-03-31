import { prisma } from "../server/prisma";
import { requireAdminUser } from "../server/requireApproved";
import { PendingUsersAdminClient } from "@/components/common/ui";

export async function AuthAdminUsersPage() {
  await requireAdminUser();

  const pendingUsers = await prisma.user.findMany({
    where: { approvalStatus: "PENDING" },
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

  const appIdRows = await prisma.user.findMany({
    where: { approvalStatus: "PENDING", registeredAppId: { not: null } },
    distinct: ["registeredAppId"],
    select: { registeredAppId: true },
  });

  const appIds = appIdRows.map((row) => row.registeredAppId).filter(Boolean) as string[];

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white">사용자 관리</h2>
        <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
          승인 대기(PENDING) 사용자를 앱별로 필터링하여 승인 또는 거절할 수 있습니다.
        </p>
      </div>
      <PendingUsersAdminClient initialAppIds={appIds} initialUsers={pendingUsers} />
    </section>
  );
}

