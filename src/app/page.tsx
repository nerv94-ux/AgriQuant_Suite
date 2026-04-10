import { requireApprovedUser } from "@/components/common/auth/server/requireApproved";
import Link from "next/link";

export default async function Home() {
  const session = await requireApprovedUser();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-100 px-4 py-16">
      <div className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white shadow-sm p-6 sm:p-7">
        <h1 className="text-2xl font-semibold text-zinc-900">어그리쿼트</h1>
        <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
          로그인 및 승인이 완료되었습니다. 어그리쿼트 데스크와 관리자 화면을 같은 계정으로 이용할 수 있습니다.
        </p>
        <p className="mt-4 text-xs text-zinc-600">
          현재 사용자:{" "}
          <span className="font-semibold">
            {session.user.email ?? session.user.name ?? session.user.id}
          </span>
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/desk"
            className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
          >
            어그리쿼트 데스크
          </Link>
          <Link
            href="/admin"
            className="inline-flex h-10 items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
          >
            관리자 센터
          </Link>
        </div>
      </div>
    </div>
  );
}
