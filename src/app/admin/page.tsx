import Link from "next/link";
import { prisma } from "@/components/common/auth/server/prisma";

export default async function AdminOverviewPage() {
  const [pendingUsers, approvedUsers, apps] = await Promise.all([
    prisma.user.count({ where: { approvalStatus: "PENDING" } }),
    prisma.user.count({ where: { approvalStatus: "APPROVED" } }),
    prisma.user.findMany({
      where: { registeredAppId: { not: null } },
      distinct: ["registeredAppId"],
      select: { registeredAppId: true },
    }),
  ]);

  const appCount = apps.length;

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white">공용 통합 관리 센터</h2>
        <p className="mt-2 text-sm text-zinc-300">
          사용자 승인(Auth)과 API 운영 상태를 한 곳에서 관리합니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="승인 대기 사용자" value={`${pendingUsers}`} tone="emerald" />
        <StatCard label="승인 완료 사용자" value={`${approvedUsers}`} tone="blue" />
        <StatCard label="등록된 앱 수" value={`${appCount}`} tone="violet" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <QuickLinkCard
          title="사용자 관리"
          description="승인 대기 사용자를 앱별로 필터링하고 승인/거절을 처리합니다."
          href="/admin/users"
        />
        <QuickLinkCard
          title="API 관리"
          description="커넥터 상태 및 환경 설정 값을 확인하고 운영 기준을 점검합니다."
          href="/admin/apis"
        />
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "blue" | "violet";
}) {
  const toneMap: Record<typeof tone, string> = {
    emerald: "from-emerald-400/20 to-emerald-500/5 border-emerald-300/20",
    blue: "from-blue-400/20 to-blue-500/5 border-blue-300/20",
    violet: "from-violet-400/20 to-violet-500/5 border-violet-300/20",
  };

  return (
    <article
      className={[
        "rounded-2xl border bg-gradient-to-br p-5 backdrop-blur-xl",
        "bg-zinc-900/60",
        toneMap[tone],
      ].join(" ")}
    >
      <p className="text-sm text-zinc-300">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </article>
  );
}

function QuickLinkCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl transition hover:border-white/20 hover:bg-zinc-900/80"
    >
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{description}</p>
      <p className="mt-4 text-xs font-semibold text-emerald-300 group-hover:text-emerald-200">
        이동하기 →
      </p>
    </Link>
  );
}

