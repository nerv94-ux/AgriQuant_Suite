"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function AdminGate({ children }: { children: ReactNode }) {
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
    if (session.user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
  }, [router, session, status]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-600 dark:text-zinc-300">
        권한 정보를 확인하고 있습니다...
      </div>
    );
  }

  if (!session || session.user.approvalStatus !== "APPROVED" || session.user.role !== "ADMIN") {
    return null;
  }

  return <>{children}</>;
}

