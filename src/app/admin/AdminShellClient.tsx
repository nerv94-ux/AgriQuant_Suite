"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AdminShellClientProps = {
  userLabel: string;
  children: ReactNode;
};

const navItems = [
  { href: "/admin", label: "개요" },
  { href: "/admin/users", label: "사용자 관리" },
  { href: "/admin/apis", label: "API 관리" },
];

export default function AdminShellClient({ userLabel, children }: AdminShellClientProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1600px]">
        <aside className="hidden lg:flex lg:w-72 lg:flex-col border-r border-white/10 bg-zinc-950/85 backdrop-blur-xl">
          <div className="px-6 py-6 border-b border-white/10">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">AgriQuote OS</p>
            <h1 className="mt-2 text-xl font-semibold text-white">통합 관리 센터</h1>
            <p className="mt-2 text-xs text-zinc-400">사용자 인증 및 API 운영을 통합 관리합니다.</p>
          </div>

          <nav className="px-3 py-4">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "mb-1 flex h-11 items-center rounded-xl px-3 text-sm transition",
                    active
                      ? "bg-white/15 text-white shadow-[0_8px_20px_-14px_rgba(255,255,255,0.35)]"
                      : "text-zinc-300 hover:bg-white/7 hover:text-white",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="text-sm text-zinc-300">Premium Ops Console</span>
              </div>
              <div className="text-xs sm:text-sm text-zinc-300">
                관리자: <span className="font-semibold text-white">{userLabel}</span>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

