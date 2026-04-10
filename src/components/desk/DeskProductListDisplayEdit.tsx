"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import DeskProductNameParts from "@/components/desk/DeskProductNameParts";
import type { DeskProduct } from "@/types/deskProduct";

type DeskProductListDisplayEditProps = {
  product: DeskProduct;
};

function normalizeSpecForInput(specLabel: string): string {
  return specLabel === "—" ? "" : specLabel;
}

export default function DeskProductListDisplayEdit({ product }: DeskProductListDisplayEditProps) {
  const router = useRouter();
  const {
    id,
    source,
    name: initialName,
    specLabel: initialSpec,
    packageUnit: initialPackage,
    nameParts,
    displayLocked,
    needsSourceReview,
    ecountProdCode,
  } = product;

  const [name, setName] = useState(initialName === "—" ? "" : initialName);
  const [spec, setSpec] = useState(normalizeSpecForInput(initialSpec));
  const [pkg, setPkg] = useState(initialPackage.trim());
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const baseline = useRef({
    name: initialName,
    spec: initialSpec,
    packageUnit: initialPackage.trim(),
  });
  const save = useCallback(async () => {
    const outName = name.trim() || "—";
    const outSpec = spec.trim() || "—";
    const outPkg = pkg.trim();
    if (
      outName === baseline.current.name &&
      outSpec === baseline.current.spec &&
      outPkg === baseline.current.packageUnit
    ) {
      return;
    }
    if (pending) return;
    setPending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/desk/products/${encodeURIComponent(id)}/list-display`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: outName, specLabel: outSpec, packageUnit: outPkg }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setErr(typeof data.message === "string" ? data.message : "저장에 실패했습니다.");
        return;
      }
      baseline.current = { name: outName, spec: outSpec, packageUnit: outPkg };
      router.refresh();
    } catch {
      setErr("저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }, [id, name, spec, pkg, pending, router]);

  const revertFromEcount = useCallback(async () => {
    if (
      !window.confirm(
        "이카운트 품목 목록 조회(GetBasicProductsList, 품목코드 단건 필터)로 최신 정보를 가져와 표시를 되돌립니다.\n포장단위는 비워지고, 다음 동기화부터 품목명·규격은 이카운트에 맞게 갱신될 수 있습니다.\n계속할까요?",
      )
    ) {
      return;
    }
    if (pending) return;
    setPending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/desk/products/${encodeURIComponent(id)}/revert-ecount-display`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setErr(typeof data.message === "string" ? data.message : "되돌리기에 실패했습니다.");
        return;
      }
      router.refresh();
    } catch {
      setErr("되돌리기 요청에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }, [id, pending, router]);

  const onBlurField = useCallback(() => {
    void save();
  }, [save]);

  if (source !== "ecount") {
    const pkgDisplay = initialPackage.trim() !== "" ? initialPackage : "—";
    return (
      <>
        <td className="min-w-[12rem] px-4 py-3 font-medium text-zinc-900">
          <DeskProductNameParts parts={nameParts} />
        </td>
        <td className="px-4 py-3 text-zinc-600">{initialSpec}</td>
        <td className="min-w-[6rem] px-4 py-3 text-zinc-600">{pkgDisplay}</td>
      </>
    );
  }

  return (
    <>
      <td className="min-w-[12rem] px-4 py-2 align-top">
        <div className="flex flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErr(null);
              }}
              onBlur={() => onBlurField()}
              disabled={pending}
              placeholder="품목명"
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm font-medium text-zinc-900 shadow-sm placeholder:text-zinc-400 disabled:opacity-60"
              autoComplete="off"
            />
            {displayLocked || needsSourceReview ? (
              <span className="flex shrink-0 items-center gap-0.5">
                {displayLocked ? (
                  <button
                    type="button"
                    disabled={pending || !ecountProdCode?.trim()}
                    onClick={() => void revertFromEcount()}
                    aria-label="이카운트 품목기본 조회로 표시 되돌리기"
                    title={
                      ecountProdCode?.trim()
                        ? "클릭: 이카운트 최신 품목기본 조회로 표시 되돌리기"
                        : "품목코드가 없어 되돌릴 수 없습니다"
                    }
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </button>
                ) : null}
                {needsSourceReview ? (
                  <span
                    role="img"
                    aria-label="이카운트 원문 변경됨, 재확인 필요"
                    title="이카운트 원문이 바뀐 뒤 아직 재확인 전"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-amber-300 bg-amber-50 text-[11px] font-bold leading-none text-amber-900"
                  >
                    !
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
          {err ? <p className="truncate text-[10px] text-red-600">{err}</p> : null}
          {pending ? <p className="text-[10px] text-zinc-500">저장 중…</p> : null}
        </div>
      </td>
      <td className="min-w-[8rem] px-4 py-2 align-top">
        <input
          value={spec}
          onChange={(e) => {
            setSpec(e.target.value);
            setErr(null);
          }}
          onBlur={() => onBlurField()}
          disabled={pending}
          placeholder="규격"
          className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800 shadow-sm placeholder:text-zinc-400 disabled:opacity-60"
          autoComplete="off"
        />
      </td>
      <td className="min-w-[6rem] px-4 py-2 align-top">
        <input
          value={pkg}
          onChange={(e) => {
            setPkg(e.target.value);
            setErr(null);
          }}
          onBlur={() => onBlurField()}
          disabled={pending}
          placeholder="예: 박스, 봉, 벌크"
          className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800 shadow-sm placeholder:text-zinc-400 disabled:opacity-60"
          autoComplete="off"
        />
      </td>
    </>
  );
}
