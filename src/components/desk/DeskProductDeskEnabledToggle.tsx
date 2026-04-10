"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeskProductDeskEnabledToggleProps = {
  productId: string;
  initialEnabled: boolean;
};

export default function DeskProductDeskEnabledToggle({ productId, initialEnabled }: DeskProductDeskEnabledToggleProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function toggle(next: boolean) {
    if (pending) return;
    setPending(true);
    const prev = enabled;
    setEnabled(next);
    try {
      const res = await fetch(`/api/desk/products/${encodeURIComponent(productId)}/desk-enabled`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        setEnabled(prev);
      } else {
        router.refresh();
      }
    } catch {
      setEnabled(prev);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="데스크에서 이 품목 사용"
      disabled={pending}
      onClick={() => toggle(!enabled)}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition active:scale-[0.96] disabled:cursor-wait disabled:active:scale-100",
        enabled ? "border-emerald-500 bg-emerald-600" : "border-zinc-300 bg-zinc-200",
        pending ? "opacity-60" : "hover:opacity-95",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "pointer-events-none absolute top-1/2 left-[3px] h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
          enabled ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}
