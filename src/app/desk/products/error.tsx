"use client";

export default function DeskProductsError({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm">
      <p className="font-semibold text-red-900">품목 목록을 불러오지 못했습니다.</p>
      <p className="mt-2 text-red-800">{error.message}</p>
      <p className="mt-4 text-xs leading-relaxed text-zinc-600">
        오류에 <code className="text-zinc-800">findMany</code>가 보이면 Prisma 클라이언트가 스키마보다 오래된 경우가 많습니다.{" "}
        <code className="text-zinc-800">node scripts/prisma-with-env.cjs generate</code> 실행 후{" "}
        <strong className="text-zinc-800">개발 서버를 재시작</strong>하세요. DB 마이그레이션은{" "}
        <code className="text-zinc-800">node scripts/prisma-with-env.cjs migrate deploy</code> 로 맞춥니다. SQLite 경로 문제면{" "}
        <code className="text-zinc-800">DATABASE_URL</code>과 <code className="text-zinc-800">dev.db</code> 위치를 확인하세요.
      </p>
    </div>
  );
}
