"use client";

import { useEffect, useRef } from "react";

type DeskProductTouchLastUsedProps = {
  deskProductId: string;
};

/** 상세 진입 시 최근 사용 정렬용 타임스탬프 갱신(실패 무시) */
export default function DeskProductTouchLastUsed({ deskProductId }: DeskProductTouchLastUsedProps) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void fetch("/api/desk/me/product-preferences/touch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deskProductId }),
    }).catch(() => {});
  }, [deskProductId]);
  return null;
}
