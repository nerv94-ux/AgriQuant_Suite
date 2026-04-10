/** 품목 목록 보기·정렬 등 세그먼트 토글 — 높이·안쪽 정렬 통일 */
export const deskSegmentBtnBase =
  [
    "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center",
    "whitespace-nowrap rounded-lg px-3 text-sm font-semibold leading-none",
    "transition select-none",
    "active:scale-[0.98] active:brightness-95",
    "disabled:cursor-wait disabled:opacity-60 disabled:active:scale-100",
  ].join(" ");

export const deskSegmentOn = "bg-emerald-600 text-white shadow-sm";
export const deskSegmentOff = "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";
