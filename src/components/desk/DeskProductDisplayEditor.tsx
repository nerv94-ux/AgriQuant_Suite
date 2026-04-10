"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type DeskProductDisplayEditorProps = {
  productId: string;
  initialName: string;
  initialSpecLabel: string;
  initialPackageUnit: string;
  initialDisplayLocked: boolean;
  needsSourceReview: boolean;
};

export default function DeskProductDisplayEditor({
  productId,
  initialName,
  initialSpecLabel,
  initialPackageUnit,
  initialDisplayLocked,
  needsSourceReview,
}: DeskProductDisplayEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [specLabel, setSpecLabel] = useState(initialSpecLabel);
  const [packageUnit, setPackageUnit] = useState(initialPackageUnit);
  const [displayLocked, setDisplayLocked] = useState(initialDisplayLocked);
  const [pending, setPending] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const onSave = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setHint(null);
    try {
      const res = await fetch(`/api/desk/products/${encodeURIComponent(productId)}/display`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, specLabel, packageUnit, displayLocked }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setHint(data.message ?? "저장에 실패했습니다.");
        return;
      }
      setHint(
        displayLocked
          ? "표시명·규격이 확정되었습니다. 이후 이카운트 동기화는 이 값을 덮어쓰지 않습니다."
          : "동기화 표시 모드로 돌렸습니다. 다음 품목 동기화 시 이카운트 기준으로 이름·규격이 갱신될 수 있습니다.",
      );
      router.refresh();
    } catch {
      setHint("저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }, [productId, name, specLabel, packageUnit, displayLocked, pending]);

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-amber-950">전사 표시명·규격 (관리자)</h3>
        {needsSourceReview ? (
          <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
            이카운트 원문 변경됨 · 재확인
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-amber-950/80">
        품목명·규격을 정리해 저장하고 &quot;동기화 값 덮어쓰기 방지&quot;를 켜면, 모든 사용자에게 같은 표시가 적용됩니다.
        이카운트에서 품목 문구가 바뀌면 위 배지가 뜨며, 내용을 다시 확인한 뒤 저장하면 됩니다.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-xs font-medium text-amber-950">
          표시 품목명
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
            autoComplete="off"
          />
        </label>
        <label className="block text-xs font-medium text-amber-950">
          표시 규격
          <input
            value={specLabel}
            onChange={(e) => setSpecLabel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
            autoComplete="off"
          />
        </label>
        <label className="block text-xs font-medium text-amber-950 sm:col-span-2 lg:col-span-1">
          포장단위
          <input
            value={packageUnit}
            onChange={(e) => setPackageUnit(e.target.value)}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
            placeholder="예: 박스, 봉, 벌크"
            autoComplete="off"
          />
        </label>
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-medium text-amber-950">
        <input
          type="checkbox"
          checked={displayLocked}
          onChange={(e) => setDisplayLocked(e.target.checked)}
          className="h-4 w-4 rounded border-amber-400 text-amber-700"
        />
        동기화 시 이카운트가 품목명·규격을 자동 덮어쓰지 않음 (확정)
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-amber-800 px-4 text-xs font-semibold text-white shadow-sm hover:bg-amber-900 disabled:opacity-60"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
        {hint ? <span className="text-xs text-amber-950/90">{hint}</span> : null}
      </div>
    </div>
  );
}
