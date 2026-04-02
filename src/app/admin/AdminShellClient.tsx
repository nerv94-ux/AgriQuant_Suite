"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  adminHomeItem,
  isAdminHrefActive,
  liveAdminModules,
  plannedAdminModules,
} from "@/components/common/admin/modules";

type AdminShellClientProps = {
  userLabel: string;
  children: ReactNode;
};

export default function AdminShellClient({ userLabel, children }: AdminShellClientProps) {
  const pathname = usePathname();
  const activePathname = pathname ?? "";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1600px]">
        <aside className="hidden border-r border-white/10 bg-zinc-950/85 backdrop-blur-xl lg:flex lg:w-80 lg:flex-col">
          <div className="border-b border-white/10 px-6 py-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">AgriQuote Admin</p>
            <h1 className="mt-2 text-xl font-semibold text-white">모듈 센터</h1>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Auth, API, UI, Logs, Programs 모듈을 같은 구조 안에서 확장합니다.
            </p>
          </div>

          <div className="border-b border-white/10 px-3 py-4">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Center
            </p>
            <Link
              href={adminHomeItem.href}
              className={[
                "flex rounded-2xl border px-4 py-3 transition",
                isAdminHrefActive(activePathname, adminHomeItem.href)
                  ? "border-white/15 bg-white/10 text-white shadow-[0_12px_30px_-18px_rgba(255,255,255,0.45)]"
                  : "border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              <div>
                <p className="text-sm font-semibold">{adminHomeItem.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {adminHomeItem.description}
                </p>
              </div>
            </Link>
          </div>

          <nav className="px-3 py-4">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Live Modules
            </p>
            <div className="space-y-2">
              {liveAdminModules.map((item) => {
                const active = item.href ? isAdminHrefActive(activePathname, item.href) : false;
                return (
                  <Link
                    key={item.id}
                    href={item.href ?? "/admin"}
                    className={[
                      "block rounded-2xl border px-4 py-3 transition",
                      active
                        ? "border-white/15 bg-white/10 text-white shadow-[0_12px_30px_-18px_rgba(255,255,255,0.45)]"
                        : "border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                          {item.summary}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                        {item.badge}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-white/10 px-3 py-4">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Planned
            </p>
            <div className="space-y-2">
              {plannedAdminModules.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">{item.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                        {item.summary}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-zinc-400">
                      {item.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="text-sm text-zinc-300">Admin Module Center</span>
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

