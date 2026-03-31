import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { registerAppForCurrentUser } from "@/components/common/auth/server/registerAppForUser";

export default async function PendingPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  await registerAppForCurrentUser({ sessionUserId: session.user.id });
  if (session.user.approvalStatus === "APPROVED") redirect("/");

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 sm:p-7">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          승인 대기 중
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          현재 계정은 <span className="font-semibold">PENDING</span> 상태로 등록되어 있습니다.
          관리자 승인 완료 후 서비스를 이용하실 수 있습니다.
        </p>
      </div>
    </div>
  );
}

