import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

const adminEmails = (process.env.NEXTAUTH_ADMIN_EMAILS ?? "")
  .split(",")
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    session: async ({ session }) => {
      // 세션 사용자 정보에 승인 상태/권한을 붙여서
      // 공용 가드 컴포넌트들이 쉽게 판단하게 할게.
      const email = session.user?.email;
      if (!email) return session;

      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true, approvalStatus: true },
      });

      if (!dbUser) return session;

      session.user = {
        ...session.user,
        id: dbUser.id,
        role: dbUser.role,
        approvalStatus: dbUser.approvalStatus,
      };

      return session;
    },
  },
  events: {
    // 첫 가입 시(=User 생성 직후) ADMIN은 자동 승인 처리
    // (관리자 승인은 업무 흐름상 자동/수동을 섞을 수 있게 열어둔 기본값)
    async createUser({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return;
      if (!adminEmails.includes(email)) return;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: "ADMIN",
          approvalStatus: "APPROVED",
        },
      });
    },
  },
};

