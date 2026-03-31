"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

export function ApprovedGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (session.user.approvalStatus !== "APPROVED") {
      router.replace("/pending");
      return;
    }
  }, [router, session, status]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-600 dark:text-zinc-300">
        인증 상태를 확인하고 있습니다...
      </div>
    );
  }

  // 리다이렉트가 걸릴 때까지 잠깐 보여줄 자리
  if (!session || session.user.approvalStatus !== "APPROVED") return null;

  return <>{children}</>;
}

