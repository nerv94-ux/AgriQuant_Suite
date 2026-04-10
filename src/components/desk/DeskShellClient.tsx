"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type DeskShellClientProps = {
  userLabel: string;
  children: ReactNode;
};

/** 좁은 화면은 전폭에 가깝게, 와이드에서 품목 표·툴바 여유 확보 */
const deskShellInner =
  "mx-auto w-full max-w-6xl px-3 sm:px-5 lg:px-6 xl:max-w-[90rem] 2xl:max-w-[min(100%,104rem)]";

function navClass(active: boolean) {
  return [
    "rounded-xl px-3 py-2 text-sm font-semibold transition",
    active
      ? "bg-emerald-600 text-white shadow-sm"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  ].join(" ");
}

export default function DeskShellClient({ userLabel, children }: DeskShellClientProps) {
  const pathname = usePathname() ?? "";

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white shadow-sm">
        <div className={`flex flex-wrap items-center justify-between gap-3 py-4 ${deskShellInner}`}>
          <Link
            href="/desk"
            className="block min-w-0 rounded-xl -m-2 p-2 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">AgriQuote</p>
            <h1 className="text-lg font-semibold text-zinc-900">어그리쿼트</h1>
            <p className="text-xs text-zinc-500">가격 결정 · 시세 조사 (내부용)</p>
          </Link>
          <p className="text-xs text-zinc-600">
            <span className="text-zinc-500">사용자</span>{" "}
            <span className="font-medium text-zinc-800">{userLabel}</span>
          </p>
        </div>
        <nav className="border-t border-zinc-100 bg-zinc-50/80">
          <div className={`flex flex-wrap gap-1 py-2 ${deskShellInner}`}>
            <Link href="/desk" className={navClass(pathname === "/desk")}>
              데스크
            </Link>
            <Link href="/desk/products" className={navClass(pathname.startsWith("/desk/products"))}>
              품목
            </Link>
            <Link
              href="/desk/auction-prices"
              className={navClass(pathname.startsWith("/desk/auction-prices"))}
            >
              시세표
            </Link>
          </div>
        </nav>
      </header>
      <main className={`py-8 ${deskShellInner}`}>{children}</main>
    </div>
  );
}
