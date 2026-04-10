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
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-zinc-100">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white shadow-sm p-6 sm:p-7">
        <h1 className="text-xl font-semibold text-zinc-900">
          승인 대기 중
        </h1>
        <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
          현재 계정은 <span className="font-semibold">PENDING</span> 상태로 등록되어 있습니다.
          관리자 승인 완료 후 서비스를 이용하실 수 있습니다.
        </p>
      </div>
    </div>
  );
}

