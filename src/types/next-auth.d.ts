import "next-auth";

declare module "next-auth" {
  type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
  type UserRole = "ADMIN" | "USER";

  interface Session {
    user: {
      id: string;
      role: UserRole;
      approvalStatus: ApprovalStatus;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

