type DeskProductNamePartsProps = {
  parts: string[];
  className?: string;
};

/** 품목명 `*` 세그먼트 — 세로로 나열해 이카운트 입력 단위에 가깝게 표시 */
export default function DeskProductNameParts({ parts, className = "" }: DeskProductNamePartsProps) {
  if (parts.length === 0) {
    return <span className="text-zinc-400">—</span>;
  }
  if (parts.length === 1) {
    return <span className={className}>{parts[0]}</span>;
  }
  return (
    <ul className={["space-y-0.5 text-left", className].filter(Boolean).join(" ")}>
      {parts.map((part, i) => (
        <li key={`${i}-${part.slice(0, 12)}`} className="leading-snug text-zinc-900">
          <span className="text-zinc-500">{i + 1}.</span> {part}
        </li>
      ))}
    </ul>
  );
}
