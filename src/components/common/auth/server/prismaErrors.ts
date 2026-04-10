function prismaErrorCode(error: unknown): string | null {
  let e: unknown = error;
  for (let i = 0; i < 6; i++) {
    if (e && typeof e === "object" && "code" in e) {
      const c = (e as { code?: unknown }).code;
      if (typeof c === "string" && c.startsWith("P")) return c;
    }
    if (e && typeof e === "object" && "cause" in e) {
      e = (e as { cause: unknown }).cause;
      continue;
    }
    break;
  }
  return null;
}

/** Prisma 클라이언트 예외를 사용자/운영자에게 안내할 문구로 바꿉니다. */
export function prismaClientErrorMessage(error: unknown): string | null {
  const code = prismaErrorCode(error);
  if (code === "P2021") {
    return "DB에 필요한 테이블이 없습니다. 프로젝트 루트에서 npm run prisma:deploy 를 실행한 뒤 개발 서버를 다시 시작하세요.";
  }
  if (code === "P2003") {
    return "사용자 정보와 연결할 수 없습니다. 로그아웃 후 다시 로그인해 보세요.";
  }
  return null;
}
