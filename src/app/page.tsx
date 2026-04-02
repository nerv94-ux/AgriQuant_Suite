import { requireApprovedUser } from "@/components/common/auth/server/requireApproved";
import Link from "next/link";

export default async function Home() {
  const session = await requireApprovedUser();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-black px-4 py-16">
      <div className="w-full max-w-2xl rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 sm:p-7">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          어그리쿼트(대시보드)
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          로그인 및 승인이 완료되었습니다. 본 모듈은 공용 인증 기준으로 사용되며,
          이후 프로그램(견적/주문/관리자 등)에도 동일한 접근 제어 정책이 적용됩니다.
        </p>
        <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-300">
          현재 사용자:{" "}
          <span className="font-semibold">
            {session.user.email ?? session.user.name ?? session.user.id}
          </span>
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/admin/apis"
            className="inline-flex h-10 items-center rounded-xl bg-black px-4 text-sm font-semibold text-white dark:bg-white dark:text-black"
          >
            API 모듈 바로가기
          </Link>
          <Link
            href="/admin"
            className="inline-flex h-10 items-center rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-zinc-900 dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            관리자 센터
          </Link>
        </div>
      </div>
    </div>
  );
}
