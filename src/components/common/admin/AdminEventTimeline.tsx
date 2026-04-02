"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";

export type AdminEventItem = {
  id: string;
  source: string;
  action: string;
  actor: string;
  ok: boolean;
  createdAt: string;
  message: string;
};

export function AdminEventTimeline({ items }: { items: AdminEventItem[] }) {
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [failedOnly, setFailedOnly] = useState(false);
  const sources = useMemo(
    () => ["ALL", ...new Set(items.map((item) => item.source).filter(Boolean))],
    [items]
  );
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (sourceFilter !== "ALL" && item.source !== sourceFilter) {
          return false;
        }
        if (failedOnly && item.ok) {
          return false;
        }
        return true;
      }),
    [failedOnly, items, sourceFilter]
  );

  return (
    <div className="rounded-[28px] border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">최근 운영 이벤트</h3>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
          {filteredItems.length}건
        </span>
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
          className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-zinc-200"
        >
          {sources.map((source) => (
            <option key={source} value={source}>
              {source === "ALL" ? "전체 소스" : source}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setFailedOnly((current) => !current)}
          className={[
            "h-9 rounded-xl border px-3 text-xs font-semibold",
            failedOnly
              ? "border-rose-300/20 bg-rose-500/15 text-rose-100"
              : "border-white/10 bg-white/5 text-zinc-300",
          ].join(" ")}
        >
          실패만 보기
        </button>
      </div>
      <div className="space-y-3">
        {filteredItems.map((item, index) => (
          <motion.article
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut", delay: index * 0.03 }}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {item.source} · {item.action}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{item.message}</p>
              </div>
              <span
                className={[
                  "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  item.ok
                    ? "border-emerald-300/20 bg-emerald-500/15 text-emerald-100"
                    : "border-rose-300/20 bg-rose-500/15 text-rose-100",
                ].join(" ")}
              >
                {item.ok ? "성공" : "실패"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              <span>{new Date(item.createdAt).toLocaleString()}</span>
              <span>•</span>
              <span>{item.actor}</span>
            </div>
          </motion.article>
        ))}
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-zinc-500">
            필터 조건에 맞는 이벤트가 없습니다.
          </div>
        ) : null}
      </div>
    </div>
  );
}
