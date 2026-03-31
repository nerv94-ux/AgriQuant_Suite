import type { ReactNode } from "react";
import { requireAdminUser } from "@/components/common/auth/server/requireApproved";
import AdminShellClient from "./AdminShellClient";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminUser();
  const userLabel = session.user.email ?? session.user.name ?? session.user.id;

  return <AdminShellClient userLabel={userLabel}>{children}</AdminShellClient>;
}

