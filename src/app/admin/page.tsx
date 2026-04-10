import Link from "next/link";
import { prisma } from "@/components/common/auth/server/prisma";
import { adminModules, liveAdminModules, plannedAdminModules } from "@/components/common/admin/modules";
import { getGeminiSettingsOverview } from "@/components/common/api/server/admin/providerSettings";
import { AnimatedNumber } from "@/components/common/admin/AnimatedNumber";
import { AdminEventTimeline, type AdminEventItem } from "@/components/common/admin/AdminEventTimeline";
import { FadeInCard } from "@/components/common/admin/FadeInCard";

export default async function AdminOverviewPage() {
  const [pendingUsers, approvedUsers, apps, apiLogCount, geminiOverview, recentApiLogs, recentAuditLogs] =
    await Promise.all([
    prisma.user.count({ where: { approvalStatus: "PENDING" } }),
    prisma.user.count({ where: { approvalStatus: "APPROVED" } }),
    prisma.user.findMany({
      where: { registeredAppId: { not: null } },
      distinct: ["registeredAppId"],
      select: { registeredAppId: true },
    }),
    prisma.apiCallLog.count(),
    getGeminiSettingsOverview(),
    prisma.apiCallLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.apiAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const appCount = apps.length;
  const configuredApiCount =
    (geminiOverview.keyStatus.configured ? 1 : 0) +
    [
      "GARAK_API_KEY",
      "ECOUNT_API_KEY",
      "ECOUNT_COMPANY_CODE",
      "NAVER_CLIENT_ID",
      "NAVER_CLIENT_SECRET",
      "ECO_CERT_SERVICE_KEY",
    ]
      .reduce((count, key) => count + (process.env[key] ? 1 : 0), 0);
  const unhealthyCount = [geminiOverview.health.status].filter((status) => status === "unhealthy").length;

  const timelineItems: AdminEventItem[] = [
    ...recentApiLogs.map((log) => ({
      id: `call-${log.id}`,
      source: log.source,
      action: log.appId ?? "CALL",
      actor: log.appId ?? "system",
      ok: log.ok,
      createdAt: log.createdAt.toISOString(),
      message: log.message ?? "API 호출 이벤트",
    })),
    ...recentAuditLogs.map((log) => ({
      id: `audit-${log.id}`,
      source: log.provider,
      action: log.action,
      actor: log.actorEmail ?? "system",
      ok: true,
      createdAt: log.createdAt.toISOString(),
      message: log.detail ?? "설정 변경 이벤트",
    })),
  ]
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
    .slice(0, 12);

  const moduleMetrics: Record<
    (typeof adminModules)[number]["id"],
    {
      eyebrow: string;
      value: string;
      helper: string;
      cta?: string;
    }
  > = {
    auth: {
      eyebrow: "승인 대기",
      value: `${pendingUsers}명`,
      helper: `승인 완료 ${approvedUsers}명 · 등록 앱 ${appCount}개`,
      cta: "사용자 관리 열기",
    },
    api: {
      eyebrow: "연결 준비",
      value: `${configuredApiCount} / 6`,
      helper: geminiOverview.keyStatus.configured
        ? "Gemini 키 저장 상태 정상"
        : "Gemini 키 저장 필요",
      cta: "API 워크스페이스 열기",
    },
    ui: {
      eyebrow: "센터 셸",
      value: "Ready",
      helper: "모듈 카드, 리스트-디테일 패턴, 공통 톤앤매너 정리",
    },
    logs: {
      eyebrow: "누적 호출",
      value: `${apiLogCount}`,
      helper: "호출 로그와 감사 로그를 묶는 전용 허브 예정",
    },
    programs: {
      eyebrow: "정책 대상",
      value: `${appCount}개`,
      helper: "프로그램별 어떤 API를 쓸지 제어하는 정책면 준비",
    },
  };

  return (
    <section>
      <div className="grid gap-4 xl:grid-cols-12">
        <FadeInCard delay={0} className="xl:col-span-8">
          <div className="overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-sm p-6 backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Admin Module Center
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-zinc-900">운영 모듈을 확장 가능한 콘솔로 재정렬합니다.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600">
              지금은 Auth와 API를 중심으로 운영하고, 다음 단계에서 UI, Logs, Programs 모듈을 같은
              구조 안에 붙일 수 있도록 `/admin`을 모듈 센터로 정리했습니다.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {liveAdminModules.map((module) => (
                <Link
                  key={module.id}
                  href={module.href ?? "/admin"}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-100"
                >
                  {module.label}
                </Link>
              ))}
            </div>
          </div>
        </FadeInCard>

        <FadeInCard delay={0.03} className="xl:col-span-4">
          <div className="h-full rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm font-semibold text-zinc-900">확장 원칙</p>
            <div className="mt-4 space-y-3">
              <PrincipleItem
                title="모듈 단위 확장"
                description="새 기능은 별도 모듈로 추가하고, 홈과 사이드바에서 같은 규칙으로 노출합니다."
              />
              <PrincipleItem
                title="리스트 + 상세 패널"
                description="커넥터나 정책 대상이 늘어나도 좌측 선택, 우측 작업 구조를 유지합니다."
              />
              <PrincipleItem
                title="프로그램 정책 계층"
                description="나중에 프로그램별 API 선택과 권한을 같은 센터에서 제어할 수 있게 설계합니다."
              />
            </div>
          </div>
        </FadeInCard>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FadeInCard delay={0.06}>
          <StatCard label="승인 대기 사용자" value={pendingUsers} tone="emerald" />
        </FadeInCard>
        <FadeInCard delay={0.09}>
          <StatCard label="승인 완료 사용자" value={approvedUsers} tone="blue" />
        </FadeInCard>
        <FadeInCard delay={0.12}>
          <StatCard label="등록된 앱 수" value={appCount} tone="violet" />
        </FadeInCard>
        <FadeInCard delay={0.15}>
          <StatCard label="비정상 커넥터" value={unhealthyCount} tone="amber" />
        </FadeInCard>
      </div>

      <div className="mt-8 grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <div className="mb-3">
            <h3 className="text-xl font-semibold text-zinc-900">모듈 맵</h3>
            <p className="mt-1 text-sm text-zinc-600">
              운영/확장 모듈을 벤토 스타일로 분리해 우선순위를 빠르게 파악합니다.
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {adminModules.map((module, index) => {
              const metric = moduleMetrics[module.id];

              return (
                <FadeInCard key={module.id} delay={0.05 + index * 0.02}>
                  <article className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm p-5 backdrop-blur-xl">
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${module.accentClassName}`}
                />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-900">
                        {module.shortLabel}
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-zinc-900">{module.label}</p>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-600">{module.description}</p>
                      </div>
                    </div>
                    <span
                      className={[
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                        module.availability === "live"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-zinc-200 bg-zinc-100 text-zinc-600",
                      ].join(" ")}
                    >
                      {module.badge}
                    </span>
                  </div>

                  <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      {metric.eyebrow}
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-zinc-900">{metric.value}</p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">{metric.helper}</p>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="text-sm text-zinc-600">{module.summary}</p>
                    {module.href ? (
                      <Link
                        href={module.href}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:border-zinc-300 hover:bg-zinc-100"
                      >
                        {metric.cta ?? "열기"}
                      </Link>
                    ) : (
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-600">
                        준비 중
                      </span>
                    )}
                  </div>
                </div>
                  </article>
                </FadeInCard>
              );
            })}
          </div>
        </div>
        <div className="xl:col-span-4">
          <FadeInCard delay={0.18}>
            <AdminEventTimeline items={timelineItems} />
          </FadeInCard>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <FadeInCard delay={0.2} className="h-full">
          <div className="h-full rounded-[28px] border border-zinc-200 bg-white shadow-sm p-5 backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-zinc-900">지금 바로 운영하는 모듈</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <QuickLinkCard
              title="사용자 관리"
              description="승인 대기 사용자를 앱별로 필터링하고 승인/거절을 처리합니다."
              href="/admin/users"
            />
            <QuickLinkCard
              title="API 워크스페이스"
              description="커넥터 상태를 리스트로 보고, 상세 패널에서 Gemini 운영 기능을 바로 관리합니다."
              href="/admin/apis"
            />
          </div>
          </div>
        </FadeInCard>

        <FadeInCard delay={0.23} className="h-full">
          <div className="h-full rounded-[28px] border border-zinc-200 bg-white shadow-sm p-5 backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-zinc-900">다음 확장 모듈</h3>
          <div className="mt-4 space-y-3">
            {plannedAdminModules.map((module) => (
              <div key={module.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-900">{module.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{module.summary}</p>
              </div>
            ))}
          </div>
          </div>
        </FadeInCard>
      </div>
    </section>
  );
}

function PrincipleItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{description}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "blue" | "violet" | "amber";
}) {
  const toneMap: Record<typeof tone, string> = {
    emerald: "from-emerald-400/20 to-emerald-500/5 border-emerald-300/20",
    blue: "from-blue-400/20 to-blue-500/5 border-blue-300/20",
    violet: "from-violet-400/20 to-violet-500/5 border-violet-300/20",
    amber: "from-amber-400/20 to-amber-500/5 border-amber-300/20",
  };

  return (
    <article
      className={[
        "rounded-2xl border bg-gradient-to-br p-5 backdrop-blur-xl",
        "bg-white shadow-sm",
        toneMap[tone],
      ].join(" ")}
    >
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-zinc-900">
        <AnimatedNumber value={value} />
      </p>
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
      className="group rounded-2xl border border-zinc-200 bg-white shadow-sm p-5 backdrop-blur-xl transition hover:border-zinc-300 hover:bg-zinc-50"
    >
      <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
      <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{description}</p>
      <p className="mt-4 text-xs font-semibold text-emerald-700 group-hover:text-emerald-800">
        이동하기 →
      </p>
    </Link>
  );
}

