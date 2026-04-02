"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export function AnimatedNumber({
  value,
  durationMs = 700,
}: {
  value: number;
  durationMs?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    const target = Number.isFinite(value) ? Math.max(0, value) : 0;
    const startValue = valueRef.current;
    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / Math.max(100, durationMs));
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + (target - startValue) * eased);
      setDisplayValue(nextValue);
      valueRef.current = nextValue;

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [durationMs, value]);

  const formatted = useMemo(() => displayValue.toLocaleString(), [displayValue]);
  return <>{formatted}</>;
}
