"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

function adminHeaderContextLabel(pathname: string): string {
  if (pathname === "/admin" || pathname === "") {
    return "모듈 센터 · 개요";
  }
  if (pathname.startsWith("/admin/apis")) {
    return "모듈 센터 · API";
  }
  if (pathname.startsWith("/admin/users")) {
    return "모듈 센터 · Auth";
  }
  return "모듈 센터";
}

export default function AdminShellClient({ userLabel, children }: AdminShellClientProps) {
  const pathname = usePathname();
  const activePathname = pathname ?? "";
  const headerContext = adminHeaderContextLabel(activePathname);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("admin:sidebar:collapsed") === "1";
  });

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("admin:sidebar:collapsed", next ? "1" : "0");
      }
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <div className="mx-auto flex w-full max-w-[1600px]">
        <aside
          className={[
            "hidden border-r border-zinc-200 bg-white shadow-sm lg:flex lg:flex-col transition-all duration-200",
            collapsed ? "lg:w-[92px]" : "lg:w-80",
          ].join(" ")}
        >
          <div className={["border-b border-zinc-200 py-6", collapsed ? "px-3" : "px-6"].join(" ")}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                {collapsed ? "AQ" : "AgriQuote Admin"}
              </p>
              <button
                type="button"
                onClick={toggleCollapsed}
                title={collapsed ? "사이드바 확장" : "사이드바 축소"}
                className="h-7 w-7 rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-700"
              >
                {collapsed ? "›" : "‹"}
              </button>
            </div>
            {!collapsed ? (
              <>
                <h1 className="mt-2 text-xl font-semibold text-zinc-900">모듈 센터</h1>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                  Auth, API, UI, Logs, Programs 모듈을 같은 구조 안에서 확장합니다.
                </p>
              </>
            ) : null}
          </div>

          <div className={["border-b border-zinc-200 py-4", collapsed ? "px-2" : "px-3"].join(" ")}>
            {!collapsed ? (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Center
              </p>
            ) : null}
            <Link
              href={adminHomeItem.href}
              title={adminHomeItem.label}
              className={[
                "flex rounded-2xl border transition",
                collapsed ? "justify-center px-2 py-3" : "px-4 py-3",
                isAdminHrefActive(activePathname, adminHomeItem.href)
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm"
                  : "border-transparent text-zinc-700 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900",
              ].join(" ")}
            >
              {collapsed ? (
                <span className="text-xs font-semibold">홈</span>
              ) : (
                <div>
                  <p className="text-sm font-semibold">{adminHomeItem.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                    {adminHomeItem.description}
                  </p>
                </div>
              )}
            </Link>
          </div>

          <nav className={["py-4", collapsed ? "px-2" : "px-3"].join(" ")}>
            {!collapsed ? (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Live Modules
              </p>
            ) : null}
            <div className="space-y-2">
              {liveAdminModules.map((item) => {
                const active = item.href ? isAdminHrefActive(activePathname, item.href) : false;
                return (
                  <Link
                    key={item.id}
                    href={item.href ?? "/admin"}
                    title={item.label}
                    className={[
                      "block rounded-2xl border transition",
                      collapsed ? "px-2 py-3 text-center" : "px-4 py-3",
                      active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm"
                        : "border-transparent text-zinc-700 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900",
                    ].join(" ")}
                  >
                    {collapsed ? (
                      <div>
                        <p className="text-xs font-semibold">{item.shortLabel}</p>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{item.label}</p>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                            {item.summary}
                          </p>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">
                          {item.badge}
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className={["border-t border-zinc-200 py-4", collapsed ? "px-2" : "px-3"].join(" ")}>
            {!collapsed ? (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Planned
              </p>
            ) : null}
            <div className="space-y-2">
              {plannedAdminModules.map((item) => (
                <div
                  key={item.id}
                  className={[
                    "rounded-2xl border border-zinc-200 bg-zinc-50",
                    collapsed ? "px-2 py-3 text-center" : "px-4 py-3",
                  ].join(" ")}
                  title={item.label}
                >
                  {collapsed ? (
                    <p className="text-xs font-semibold text-zinc-700">{item.shortLabel}</p>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                          {item.summary}
                        </p>
                      </div>
                      <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-600">
                        {item.badge}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="truncate text-sm text-zinc-700">{headerContext}</span>
              </div>
              <div className="text-xs sm:text-sm text-zinc-700">
                관리자: <span className="font-semibold text-zinc-900">{userLabel}</span>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

