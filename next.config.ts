import type { NextConfig } from "next";

/**
 * NextAuth는 기본적으로 `NEXTAUTH_URL`만 쓰고 요청 Host를 무시합니다.
 * LAN IP(예: http://192.168.0.227:3000)로 접속해 Google 로그인하려면
 * `AUTH_TRUST_HOST`가 필요합니다(미설정 시 개발에서만 켭니다).
 * Google Cloud 콘솔에도 동일 Origin·redirect URI를 등록해야 합니다.
 */
if (process.env.NODE_ENV === "development" && process.env.AUTH_TRUST_HOST === undefined) {
  process.env.AUTH_TRUST_HOST = "true";
}

const nextConfig: NextConfig = {
  /** Prisma 7 + 어댑터는 서버 번들에 넣으면 delegate가 깨질 수 있어 명시적으로 외부 로드 */
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
  ],
};

export default nextConfig;
