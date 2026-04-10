import type { ReactNode } from "react";
import { requireApprovedUser } from "@/components/common/auth/server/requireApproved";
import DeskShellClient from "@/components/desk/DeskShellClient";

export default async function DeskLayout({ children }: { children: ReactNode }) {
  const session = await requireApprovedUser();
  const userLabel = session.user.email ?? session.user.name ?? session.user.id;

  return <DeskShellClient userLabel={userLabel}>{children}</DeskShellClient>;
}
