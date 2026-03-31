import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "./authOptions";
import { registerAppForCurrentUser } from "./registerAppForUser";

export async function requireApprovedUser() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // 승인 여부와 무관하게, 최초 1회는 어떤 '앱'에서 가입했는지 저장
  await registerAppForCurrentUser({ sessionUserId: session.user.id });

  const { approvalStatus } = session.user;
  if (approvalStatus !== "APPROVED") {
    redirect("/pending");
  }

  return session;
}

export async function requireAdminUser() {
  const session = await requireApprovedUser();

  if (session.user.role !== "ADMIN") {
    redirect("/"); // 임시: 권한 없으면 홈으로
  }

  return session;
}

