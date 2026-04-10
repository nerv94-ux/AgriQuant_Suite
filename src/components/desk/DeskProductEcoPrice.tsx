"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { resolveEcoPriceCodes } from "@/components/desk/server/ecoPriceDeskCodes";

type EcoResolved = {
  ctgryCd: string | null;
  itemCd: string | null;
  vrtyCd: string | null;
  grdCd: string | null;
  sggCd: string | null;
  mrktCd: string | null;
  source: "saved" | "inferred" | "empty";
  detail?: "need_ctgry_item";
};

type EcoPriceApiData = {
  totalCount?: number;
  items?: Record<string, unknown>[];
  resolved?: EcoResolved;
  usedRelaxedInference?: boolean;
};

type EcoCandidate = {
  ctgryCd: string;
  itemCd: string;
  vrtyCd: string;
  itemName: string;
  vrtyName: string;
  count: number;
};

function ymdToDateInput(ymd: string): string {
  if (!/^\d{8}$/.test(ymd)) return "";
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function dateInputToYmd(v: string): string {
  return v.replace(/-/g, "");
}

function daysAgoYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function todayYmd(): string {
  return daysAgoYmd(0);
}

const PREFERRED_KEYS = [
  "exmn_ymd",
  "exmnYmd",
  "se_nm",
  "seNm",
  "ctgry_nm",
  "ctgryNm",
  "item_nm",
  "itemNm",
  "vrty_nm",
  "vrtyNm",
  "grd_nm",
  "grdNm",
  "sgg_nm",
  "sggNm",
  "mrkt_nm",
  "mrktNm",
  "prc",
  "price",
  "avg_prc",
  "avgPrc",
  "unit",
  "unit_sz",
  "unitSz",
  "exmn_dd_cnvs_prc",
  "exmn_dd_prc",
  "exmnDdCnvsPrc",
  "exmnDdPrc",
];

/** 공공 API 원본 필드명 → 화면용 한글 (명세·기관마다 열 이름이 달라 매핑을 확장할 수 있음) */
const ECO_COLUMN_LABEL_KO: Record<string, string> = {
  exmn_ymd: "조사일자",
  exmnYmd: "조사일자",
  se_nm: "구분·시점",
  seNm: "구분·시점",
  sp_nm: "구분·유형",
  spNm: "구분·유형",
  ctgry_cd: "부류 코드",
  ctgryCd: "부류 코드",
  ctgry_nm: "부류명",
  ctgryNm: "부류명",
  item_cd: "품목 코드",
  itemCd: "품목 코드",
  item_nm: "품목명",
  itemNm: "품목명",
  vrty_cd: "품종 코드",
  vrtyCd: "품종 코드",
  vrty_nm: "품종명",
  vrtyNm: "품종명",
  grd_cd: "등급 코드",
  grdCd: "등급 코드",
  grd_nm: "등급명",
  grdNm: "등급명",
  sgg_cd: "시군구 코드",
  sggCd: "시군구 코드",
  sgg_nm: "시군구",
  sggNm: "시군구",
  mrkt_cd: "시장 코드",
  mrktCd: "시장 코드",
  mrkt_nm: "도매·시장",
  mrktNm: "도매·시장",
  mkt_nm: "유통채널·매장유형",
  mktNm: "유통채널·매장유형",
  exmn_dd_cnvs_prc: "환산가(원)·비교용",
  exmn_dd_prc: "조사일 소매가(원)·묶음",
  exmnDdCnvsPrc: "환산가(원)·비교용",
  exmnDdPrc: "조사일 소매가(원)·묶음",
  prc: "가격(원)",
  price: "가격(원)",
  avg_prc: "평균가(원)",
  avgPrc: "평균가(원)",
  unit: "단위(기호)",
  unit_sz: "판매 단위 무게(g)",
  unitSz: "판매 단위 무게(g)",
  amt: "금액(원)",
  tot_amt: "합계(원)",
  totAmt: "합계(원)",
  qnt: "수량",
  qty: "수량",
  orgnl_reg_dt: "등록일시",
  orgnlRegDt: "등록일시",
  se_cd: "구분 코드",
  seCd: "구분 코드",
};

/** 긴 설명은 머리글에 넣지 않고 title 툴팁으로만 표시(표 레이아웃 깨짐 방지) */
const ECO_COLUMN_HINT_KO: Record<string, string> = {
  exmn_dd_cnvs_prc:
    "보통 1kg(1000g) 기준으로 맞춘 ‘비교용’ 금액입니다. unit_sz가 500이고 소매가 9000원이면 9000÷500×1000=18000원/kg처럼 맞는지 확인해 보세요. 100g당 9000원이 아닙니다.",
  exmn_dd_prc:
    "조사일에 그 매장에서 판매한 ‘한 묶음’의 총 가격입니다. unit_sz(예:500)가 있으면 500g 한 봉지(또는 한 판매단위) 전체가 9000원인 뜻입니다.",
  exmnDdCnvsPrc:
    "보통 1kg(1000g) 기준으로 맞춘 ‘비교용’ 금액입니다. unit_sz와 소매가로 나눗셈 검증 가능.",
  exmnDdPrc: "조사일 한 묶음(판매단위) 총액. unit_sz와 같이 보세요.",
  unit:
    "무게의 ‘종류’만 표시(g 등). 몇 g짜리 묶음인 숫자는 unit_sz 열을 보세요.",
  unit_sz:
    "이 행 소매가가 적용되는 판매 묶음의 무게(g). 예: 500이면 500g 한 단위의 가격이 조사일 소매가에 해당.",
  unitSz:
    "이 행 소매가가 적용되는 판매 묶음의 무게(g). 예: 500이면 500g 한 단위의 가격이 조사일 소매가에 해당.",
};

function hintForEcoColumnKey(key: string): string | undefined {
  return ECO_COLUMN_HINT_KO[key];
}

function labelForEcoColumnKey(key: string): string {
  const mapped = ECO_COLUMN_LABEL_KO[key];
  if (mapped) return mapped;
  if (key.includes("_")) {
    return key
      .split("_")
      .map((p) => p.trim())
      .filter(Boolean)
      .join(" ");
  }
  return key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function isLikelyPriceColumnKey(key: string): boolean {
  return /prc|price|amt|avg|cost|won|tot|금액|가격|평균/i.test(key);
}

function collectColumnKeys(items: Record<string, unknown>[]): string[] {
  const found = new Set<string>();
  for (const row of items.slice(0, 30)) {
    for (const k of Object.keys(row)) {
      found.add(k);
    }
  }
  const pref = PREFERRED_KEYS.filter((k) => found.has(k));
  const rest = [...found].filter((k) => !PREFERRED_KEYS.includes(k)).sort();
  return [...pref, ...rest].slice(0, 20);
}

function cellStr(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v).trim();
  return s === "" ? "—" : s;
}

function formatEcoTableCell(v: unknown, columnKey: string): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);

  if (isLikelyPriceColumnKey(columnKey)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      return `${Math.trunc(v).toLocaleString("ko-KR")}원`;
    }
    const raw = String(v).trim().replace(/,/g, "");
    if (raw !== "" && /^\d+(\.\d+)?$/.test(raw)) {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        return Number.isInteger(n) || n === Math.trunc(n)
          ? `${Math.trunc(n).toLocaleString("ko-KR")}원`
          : `${n.toLocaleString("ko-KR")}원`;
      }
    }
  }

  return cellStr(v);
}

function pickStr(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function normalizeForMatch(v: string): string {
  return v.toLowerCase().replace(/\s+/g, "");
}

function collectEcoCandidates(items: Record<string, unknown>[], productName: string): EcoCandidate[] {
  const m = new Map<string, EcoCandidate>();
  const needle = normalizeForMatch(productName);
  for (const row of items) {
    const ctgryCd = pickStr(row, ["ctgry_cd", "ctgryCd"]);
    const itemCd = pickStr(row, ["item_cd", "itemCd"]);
    const vrtyCd = pickStr(row, ["vrty_cd", "vrtyCd"]);
    if (!ctgryCd || !itemCd || !vrtyCd) continue;

    const itemName = pickStr(row, ["item_nm", "itemNm"]);
    const vrtyName = pickStr(row, ["vrty_nm", "vrtyNm"]);
    const key = `${ctgryCd}|${itemCd}|${vrtyCd}|${itemName}|${vrtyName}`;
    const prev = m.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      m.set(key, { ctgryCd, itemCd, vrtyCd, itemName, vrtyName, count: 1 });
    }
  }
  const arr = [...m.values()];
  arr.sort((a, b) => {
    const aText = normalizeForMatch(`${a.itemName} ${a.vrtyName}`);
    const bText = normalizeForMatch(`${b.itemName} ${b.vrtyName}`);
    const aHit = needle && aText.includes(needle) ? 1 : 0;
    const bHit = needle && bText.includes(needle) ? 1 : 0;
    if (aHit !== bHit) return bHit - aHit;
    if (a.count !== b.count) return b.count - a.count;
    return `${a.ctgryCd}${a.itemCd}${a.vrtyCd}`.localeCompare(`${b.ctgryCd}${b.itemCd}${b.vrtyCd}`, "ko");
  });
  return arr.slice(0, 12);
}

type EcoSuggestRow = {
  ctgryCd: string;
  itemCd: string;
  vrtyCd: string;
  itemName: string;
  vrtyName: string;
  count: number;
};

type DeskProductEcoPriceProps = {
  productId: string;
  productName: string;
  /** 규격 라벨 — 친환경 코드 자동 후보 검색어에 사용 */
  specLabel: string;
  initialEcoCtgryCd: string | null;
  initialEcoItemCd: string | null;
  initialEcoVrtyCd: string | null;
  initialEcoGrdCd: string | null;
  initialEcoSggCd: string | null;
  initialEcoMrktCd: string | null;
  savedMafraLarge: string | null;
  savedMafraMid: string | null;
  savedMafraSmall: string | null;
};

export default function DeskProductEcoPrice({
  productId,
  productName,
  specLabel,
  initialEcoCtgryCd,
  initialEcoItemCd,
  initialEcoVrtyCd,
  initialEcoGrdCd,
  initialEcoSggCd,
  initialEcoMrktCd,
  savedMafraLarge,
  savedMafraMid,
  savedMafraSmall,
}: DeskProductEcoPriceProps) {
  const router = useRouter();
  const [fromInput, setFromInput] = useState(() => ymdToDateInput(daysAgoYmd(7)));
  const [toInput, setToInput] = useState(() => ymdToDateInput(todayYmd()));

  const [ecoCtgryCd, setEcoCtgryCd] = useState(initialEcoCtgryCd ?? "");
  const [ecoItemCd, setEcoItemCd] = useState(initialEcoItemCd ?? "");
  const [ecoVrtyCd, setEcoVrtyCd] = useState(initialEcoVrtyCd ?? "");
  const [ecoGrdCd, setEcoGrdCd] = useState(initialEcoGrdCd ?? "");
  const [ecoSggCd, setEcoSggCd] = useState(initialEcoSggCd ?? "");
  const [ecoMrktCd, setEcoMrktCd] = useState(initialEcoMrktCd ?? "");

  useEffect(() => {
    setEcoCtgryCd(initialEcoCtgryCd ?? "");
    setEcoItemCd(initialEcoItemCd ?? "");
    setEcoVrtyCd(initialEcoVrtyCd ?? "");
    setEcoGrdCd(initialEcoGrdCd ?? "");
    setEcoSggCd(initialEcoSggCd ?? "");
    setEcoMrktCd(initialEcoMrktCd ?? "");
  }, [
    initialEcoCtgryCd,
    initialEcoItemCd,
    initialEcoVrtyCd,
    initialEcoGrdCd,
    initialEcoSggCd,
    initialEcoMrktCd,
  ]);

  const [saveBusy, setSaveBusy] = useState(false);
  const [saveHint, setSaveHint] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [resolved, setResolved] = useState<EcoResolved | null>(null);
  const [usedRelaxedInference, setUsedRelaxedInference] = useState(false);
  const [queried, setQueried] = useState(false);
  const [pickedCandidateKey, setPickedCandidateKey] = useState<string | null>(null);

  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestKeyword, setSuggestKeyword] = useState<string | null>(null);
  const [suggestRows, setSuggestRows] = useState<EcoSuggestRow[]>([]);
  const [suggestHint, setSuggestHint] = useState<string | null>(null);
  const [suggestSampleSize, setSuggestSampleSize] = useState<number | null>(null);

  const previewResolved = useMemo(
    () =>
      resolveEcoPriceCodes({
        ecoCtgryCd: ecoCtgryCd.trim() || null,
        ecoItemCd: ecoItemCd.trim() || null,
        ecoVrtyCd: ecoVrtyCd.trim() || null,
        ecoGrdCd: ecoGrdCd.trim() || null,
        ecoSggCd: ecoSggCd.trim() || null,
        ecoMrktCd: ecoMrktCd.trim() || null,
        mafraLarge: savedMafraLarge,
        mafraMid: savedMafraMid,
        mafraSmall: savedMafraSmall,
      }),
    [
      ecoCtgryCd,
      ecoItemCd,
      ecoVrtyCd,
      ecoGrdCd,
      ecoSggCd,
      ecoMrktCd,
      savedMafraLarge,
      savedMafraMid,
      savedMafraSmall,
    ],
  );

  const mafraHint = useMemo(() => {
    const parts = [savedMafraLarge, savedMafraMid, savedMafraSmall].map((s) => (s ?? "").trim()).filter(Boolean);
    return parts.length ? parts.join(" · ") : "없음";
  }, [savedMafraLarge, savedMafraMid, savedMafraSmall]);

  const onSaveCodes = useCallback(async () => {
    setSaveBusy(true);
    setSaveHint(null);
    try {
      const res = await fetch(`/api/desk/products/${encodeURIComponent(productId)}/eco-codes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ecoCtgryCd,
          ecoItemCd,
          ecoVrtyCd,
          ecoGrdCd,
          ecoSggCd,
          ecoMrktCd,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || json.ok !== true) {
        setSaveHint(json.message ?? "저장에 실패했습니다.");
        return;
      }
      setSaveHint("저장했습니다.");
      router.refresh();
    } catch {
      setSaveHint("저장에 실패했습니다.");
    } finally {
      setSaveBusy(false);
    }
  }, [ecoCtgryCd, ecoItemCd, ecoVrtyCd, ecoGrdCd, ecoSggCd, ecoMrktCd, productId, router]);

  const fetchPrices = useCallback(async (override?: Partial<Record<"ecoCtgryCd" | "ecoItemCd" | "ecoVrtyCd" | "ecoGrdCd" | "ecoSggCd" | "ecoMrktCd", string>>) => {
    const fromYmd = dateInputToYmd(fromInput);
    const toYmd = dateInputToYmd(toInput);
    if (!/^\d{8}$/.test(fromYmd) || !/^\d{8}$/.test(toYmd)) {
      setErr("조회 기간을 선택해 주세요.");
      setItems([]);
      setTotalCount(null);
      setResolved(null);
      setUsedRelaxedInference(false);
      return;
    }
    setBusy(true);
    setErr(null);
    setQueried(false);
    const qCtgry = (override?.ecoCtgryCd ?? ecoCtgryCd).trim();
    const qItem = (override?.ecoItemCd ?? ecoItemCd).trim();
    const qVrty = (override?.ecoVrtyCd ?? ecoVrtyCd).trim();
    const qGrd = (override?.ecoGrdCd ?? ecoGrdCd).trim();
    const qSgg = (override?.ecoSggCd ?? ecoSggCd).trim();
    const qMrkt = (override?.ecoMrktCd ?? ecoMrktCd).trim();
    try {
      const u = new URL("/api/desk/eco-prices", window.location.origin);
      u.searchParams.set("deskProductId", productId);
      u.searchParams.set("fromDate", fromYmd);
      u.searchParams.set("toDate", toYmd);
      u.searchParams.set("numOfRows", "80");
      u.searchParams.set("ecoCtgryCd", qCtgry);
      u.searchParams.set("ecoItemCd", qItem);
      u.searchParams.set("ecoVrtyCd", qVrty);
      u.searchParams.set("ecoGrdCd", qGrd);
      u.searchParams.set("ecoSggCd", qSgg);
      u.searchParams.set("ecoMrktCd", qMrkt);
      const res = await fetch(u.toString(), { credentials: "same-origin" });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        data?: EcoPriceApiData;
      };
      if (!res.ok || json.ok !== true || !json.data) {
        setErr(typeof json.message === "string" ? json.message : "조회에 실패했습니다.");
        setItems([]);
        setTotalCount(null);
        setResolved(null);
        setUsedRelaxedInference(false);
        setQueried(true);
        return;
      }
      setItems(Array.isArray(json.data.items) ? json.data.items : []);
      setTotalCount(typeof json.data.totalCount === "number" ? json.data.totalCount : null);
      setResolved(json.data.resolved ?? null);
      setUsedRelaxedInference(Boolean(json.data.usedRelaxedInference));
      setQueried(true);
    } catch {
      setErr("네트워크 오류로 조회하지 못했습니다.");
      setItems([]);
      setTotalCount(null);
      setResolved(null);
      setUsedRelaxedInference(false);
      setQueried(true);
    } finally {
      setBusy(false);
    }
  }, [fromInput, toInput, productId, ecoCtgryCd, ecoItemCd, ecoVrtyCd, ecoGrdCd, ecoSggCd, ecoMrktCd]);

  const fetchSuggestCodes = useCallback(async () => {
    const fromYmd = dateInputToYmd(fromInput);
    const toYmd = dateInputToYmd(toInput);
    if (!/^\d{8}$/.test(fromYmd) || !/^\d{8}$/.test(toYmd)) {
      setSuggestHint("조회 기간을 먼저 선택해 주세요.");
      return;
    }
    setSuggestBusy(true);
    setSuggestHint(null);
    try {
      const u = new URL("/api/desk/eco-prices/suggest", window.location.origin);
      u.searchParams.set("deskProductId", productId);
      u.searchParams.set("fromDate", fromYmd);
      u.searchParams.set("toDate", toYmd);
      const res = await fetch(u.toString(), { credentials: "same-origin" });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          keyword?: string;
          suggestions?: EcoSuggestRow[];
          hint?: string;
          rowSampleSize?: number;
        };
      };
      if (!res.ok || json.ok !== true || !json.data) {
        setSuggestRows([]);
        setSuggestKeyword(null);
        setSuggestSampleSize(null);
        setSuggestHint(typeof json.message === "string" ? json.message : "후보 조회에 실패했습니다.");
        return;
      }
      setSuggestKeyword(json.data.keyword ?? null);
      setSuggestRows(Array.isArray(json.data.suggestions) ? json.data.suggestions : []);
      setSuggestSampleSize(typeof json.data.rowSampleSize === "number" ? json.data.rowSampleSize : null);
      const empty = !(json.data.suggestions && json.data.suggestions.length > 0);
      setSuggestHint(empty ? (json.data.hint ?? json.message ?? null) : null);
    } catch {
      setSuggestHint("네트워크 오류로 후보를 불러오지 못했습니다.");
      setSuggestRows([]);
      setSuggestKeyword(null);
      setSuggestSampleSize(null);
    } finally {
      setSuggestBusy(false);
    }
  }, [fromInput, toInput, productId]);

  const onPickSuggestedRow = useCallback(
    async (s: EcoSuggestRow) => {
      setEcoCtgryCd(s.ctgryCd);
      setEcoItemCd(s.itemCd);
      setEcoVrtyCd(s.vrtyCd);
      setPickedCandidateKey(`${s.ctgryCd}|${s.itemCd}|${s.vrtyCd}`);
      await fetchPrices({
        ecoCtgryCd: s.ctgryCd,
        ecoItemCd: s.itemCd,
        ecoVrtyCd: s.vrtyCd,
      });
    },
    [fetchPrices],
  );

  const columns = useMemo(() => collectColumnKeys(items), [items]);
  const ecoExmnPriceGuide = useMemo(() => {
    const hasCnvs = columns.some((c) => /cnvs_prc/i.test(c));
    const hasDd = columns.some((c) => /(^|_)exmn_dd_prc$/i.test(c) || c === "exmnDdPrc");
    const hasUnitG = columns.includes("unit");
    return {
      show: hasCnvs || hasDd,
      hasCnvs,
      hasDd,
      hasUnitG,
    };
  }, [columns]);
  const candidates = useMemo(() => collectEcoCandidates(items, productName), [items, productName]);

  const onPickCandidate = useCallback(
    async (c: EcoCandidate) => {
      setEcoCtgryCd(c.ctgryCd);
      setEcoItemCd(c.itemCd);
      setEcoVrtyCd(c.vrtyCd);
      setPickedCandidateKey(`${c.ctgryCd}|${c.itemCd}|${c.vrtyCd}`);
      await fetchPrices({
        ecoCtgryCd: c.ctgryCd,
        ecoItemCd: c.itemCd,
        ecoVrtyCd: c.vrtyCd,
      });
    },
    [fetchPrices],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 px-4 py-3 text-xs leading-relaxed text-emerald-950">
        <strong className="font-semibold">친환경 농산물 가격(조사)</strong>은 소매 유통 채널 기준 공공 조사 데이터입니다.{" "}
        <strong>도매 경매 낙찰가</strong>와는 용도가 다릅니다(소비자가·소매 레퍼런스용). 관리자에{" "}
        <span className="font-mono text-[11px]">ECO_PRICE</span> URL·키가 설정되어 있어야 합니다.
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2 text-xs leading-relaxed text-sky-950">
        <strong className="font-semibold">코드를 모를 때</strong> 조회 기간을 고른 뒤 「품목명으로 친환경 코드 후보 찾기」를 누르세요. DB에 저장된{" "}
        <strong>품목명·규격</strong>으로 검색어를 만들고, 같은 기간의 공공 API 샘플(최대 약 300행)에서 품목명이 맞는 행의 부류·품목·품종
        코드를 후보로 제시합니다. 맞는 줄을 누르면 칸에 반영되고 곧바로 가격 조회가 실행됩니다.
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchSuggestCodes()}
            disabled={suggestBusy || busy}
            className="rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-50"
          >
            {suggestBusy ? "샘플 불러오는 중…" : "품목명으로 친환경 코드 후보 찾기"}
          </button>
          {suggestSampleSize != null ? (
            <span className="text-[11px] text-sky-800/90">샘플 {suggestSampleSize}행 비교</span>
          ) : null}
        </div>
        {suggestKeyword ? (
          <p className="mt-1.5 font-mono text-[11px] text-sky-900">검색어: {suggestKeyword}</p>
        ) : null}
        {suggestHint ? <p className="mt-1.5 text-[11px] text-amber-900">{suggestHint}</p> : null}
        {suggestRows.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestRows.map((s) => (
              <button
                key={`${s.ctgryCd}-${s.itemCd}-${s.vrtyCd}-${s.itemName}-${s.vrtyName}`}
                type="button"
                onClick={() => void onPickSuggestedRow(s)}
                className="rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-[11px] text-sky-900 hover:bg-sky-100"
              >
                {`${s.itemName || "품목"} ${s.vrtyName || ""}`.trim()} · {s.ctgryCd}-{s.itemCd}-{s.vrtyCd} ({s.count}건)
              </button>
            ))}
          </div>
        ) : null}
        <p className="mt-1.5 text-[11px] text-sky-800/85">
          기준 품목명·규격: 「{productName}」 / 「{specLabel}」
        </p>
      </div>

      {previewResolved.source === "empty" && previewResolved.detail === "need_ctgry_item" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
          <strong className="font-semibold">부류·품목 코드가 아직 없습니다.</strong> MAFRA 대·중이{" "}
          <span className="font-mono">숫자 3자리</span>로 저장되지 않으면 친환경 쪽에서 부류·품목을 추정할 수 없고, 품종(소)만
          맞으면 다른 작물이 섞인 결과가 나올 수 있습니다. 상세에서 대·중 코드를 맞추거나, 아래 부류·품목을 직접 입력하세요.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-xs font-medium text-zinc-700">
          부류(ctgry)
          <input
            value={ecoCtgryCd}
            onChange={(e) => setEcoCtgryCd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs text-zinc-900"
            placeholder="자동·수정"
            maxLength={32}
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700">
          품목(item)
          <input
            value={ecoItemCd}
            onChange={(e) => setEcoItemCd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs text-zinc-900"
            placeholder="자동·수정"
            maxLength={32}
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700">
          품종(vrty)
          <input
            value={ecoVrtyCd}
            onChange={(e) => setEcoVrtyCd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs text-zinc-900"
            placeholder="자동·수정"
            maxLength={32}
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700">
          등급(grd)
          <input
            value={ecoGrdCd}
            onChange={(e) => setEcoGrdCd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs text-zinc-900"
            placeholder="선택"
            maxLength={32}
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700">
          시군구(sgg)
          <input
            value={ecoSggCd}
            onChange={(e) => setEcoSggCd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs text-zinc-900"
            placeholder="선택"
            maxLength={32}
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700">
          시장(mrkt)
          <input
            value={ecoMrktCd}
            onChange={(e) => setEcoMrktCd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs text-zinc-900"
            placeholder="선택"
            maxLength={32}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onSaveCodes()}
          disabled={saveBusy}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          {saveBusy ? "저장 중…" : "친환경 코드 저장"}
        </button>
        {saveHint ? <span className="text-xs text-zinc-600">{saveHint}</span> : null}
      </div>

      <p className="text-[11px] text-zinc-500">
        MAFRA 대·중·소(저장값): <span className="font-mono text-zinc-700">{mafraHint}</span> — 조회에는{" "}
        <strong>부류·품목</strong>이 필요합니다. 코드를 모르면 위 「품목명으로 친환경 코드 후보 찾기」를 사용하거나, 아래 칸에
        직접 입력 후 저장하세요.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs font-medium text-zinc-700">
          시작일
          <input
            type="date"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="mt-1 block rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700">
          종료일
          <input
            type="date"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            className="mt-1 block rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900"
          />
        </label>
        <button
          type="button"
          onClick={() => void fetchPrices()}
          disabled={busy}
          className="rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy ? "조회 중…" : "가격 조회"}
        </button>
      </div>

      {resolved ? (
        <p className="text-[11px] text-zinc-600">
          적용 코드: 부류 {resolved.ctgryCd ?? "—"} · 품목 {resolved.itemCd ?? "—"} · 품종 {resolved.vrtyCd ?? "—"}
          {resolved.grdCd ? ` · 등급 ${resolved.grdCd}` : ""}
          {resolved.sggCd ? ` · 시군구 ${resolved.sggCd}` : ""}
          {resolved.mrktCd ? ` · 시장 ${resolved.mrktCd}` : ""}
          <span className="ml-2 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
            {resolved.source === "saved" ? "저장 우선" : resolved.source === "inferred" ? "MAFRA 추정" : "—"}
          </span>
          {usedRelaxedInference ? (
            <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-800">
              추정 0건 → 품종만 생략 후 재조회(부류·품목 유지)
            </span>
          ) : null}
        </p>
      ) : null}

      {err ? (
        <p className="text-sm text-red-600">
          {err}
          {/비활성|ECO_PRICE|키|URL/i.test(err) ? (
            <span className="mt-1 block text-xs text-zinc-600">
              관리자 → API 연동에서 친환경 가격 URL·Service Key를 확인해 주세요.
            </span>
          ) : null}
        </p>
      ) : null}

      {items.length > 0 && candidates.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
          <p className="mb-2 text-xs font-semibold text-zinc-700">결과에서 품목 후보 선택 (코드 자동 반영)</p>
          <div className="flex flex-wrap gap-2">
            {candidates.map((c) => {
              const key = `${c.ctgryCd}|${c.itemCd}|${c.vrtyCd}`;
              const active = pickedCandidateKey === key;
              const label = `${c.itemName || "품목"} ${c.vrtyName || ""}`.trim();
              return (
                <button
                  key={`${key}-${label}`}
                  type="button"
                  onClick={() => void onPickCandidate(c)}
                  className={[
                    "rounded-lg border px-2.5 py-1.5 text-xs",
                    active
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100",
                  ].join(" ")}
                >
                  {label} · {c.ctgryCd}-{c.itemCd}-{c.vrtyCd} ({c.count}건)
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <p className="border-b border-zinc-100 bg-zinc-50/80 px-3 py-2 text-[11px] leading-relaxed text-zinc-600">
            아래 표는 <strong className="text-zinc-800">공공 API가 주는 컬럼명</strong>을 그대로 쓰되, 윗줄에 한글 설명을 붙였습니다.
            <strong className="text-zinc-800"> 가격·평균가</strong> 열은 숫자를 원 단위로 읽기 쉽게 표시합니다. 기관·버전마다 열 이름이
            다를 수 있어, 의심되면 윗줄 한글과 아랫줄 영문 키를 함께 보시면 됩니다.
            {ecoExmnPriceGuide.show ? (
              <>
                <br />
                <span className="mt-1.5 inline-block">
                  <strong className="text-zinc-800">조사일 소매가(exmn_dd_prc) vs 환산가(exmn_dd_cnvs_prc):</strong>{" "}
                  <strong className="text-emerald-900">조사일 소매가</strong>는 보통{" "}
                  <strong>unit_sz g짜리 한 묶음(한 봉지 등) 전체의 총 가격</strong>입니다. 예: unit_sz=500이고 9,000원이면{" "}
                  <strong>500g 한 묶음에 9,000원</strong>이지, 100g당 9,000원이 아닙니다.{" "}
                  <strong className="text-emerald-900">환산가</strong>는 품목·매장을 맞춰 비교하려고{" "}
                  <strong>같은 기준(대개 1kg=1000g)당 금액</strong>으로 올린 값인 경우가 많습니다. 위 예에서는 9,000÷500×1,000=
                  18,000원/kg처럼 맞는지 확인할 수 있습니다. 정의는 <strong>공공데이터 명세</strong>가 최종 기준입니다.
                </span>
                {ecoExmnPriceGuide.hasUnitG ? (
                  <>
                    <br />
                    <span className="mt-1.5 inline-block">
                      <strong className="text-zinc-800">unit만 g이고 숫자가 없을 때:</strong> 같은 행의{" "}
                      <strong className="font-mono text-zinc-800">unit_sz</strong>가 몇 g 묶음인지 알려 줍니다.
                    </span>
                  </>
                ) : null}
              </>
            ) : null}
          </p>
          <table className="w-max min-w-full border-collapse text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] text-zinc-600">
              <tr>
                {columns.map((k) => {
                  const hint = hintForEcoColumnKey(k);
                  const label = labelForEcoColumnKey(k);
                  const tip = hint ? `${label} (${k}) — ${hint}` : `${label} (${k})`;
                  return (
                    <th
                      key={k}
                      title={tip}
                      className={[
                        "min-w-[6.5rem] max-w-[11rem] align-top border-r border-zinc-100 px-2.5 py-2 text-left font-semibold last:border-r-0",
                        hint ? "cursor-help" : "",
                      ].join(" ")}
                    >
                      <div className="break-words text-zinc-900">{label}</div>
                      <div className="mt-1 break-all font-mono text-[10px] font-normal leading-snug text-zinc-400">
                        {k}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((row, i) => (
                <tr key={i} className="hover:bg-zinc-50/80">
                  {columns.map((k) => (
                    <td
                      key={k}
                      className="align-top whitespace-nowrap border-r border-zinc-50 px-2.5 py-2 text-xs text-zinc-800 last:border-r-0"
                    >
                      {formatEcoTableCell(row[k], k)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {totalCount != null && totalCount > items.length ? (
            <p className="border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500">
              전체 {totalCount}건 중 {items.length}건 표시입니다. 기간을 줄이거나 코드를 좁히면 더 정확합니다.
            </p>
          ) : null}
        </div>
      ) : !busy && !err && queried ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          조회 결과가 없습니다(0건).
          <p className="mt-1 text-xs text-zinc-600">
            지금 코드(부류/품목/품종)가 실제 친환경 코드표와 다를 수 있습니다. 위 코드 칸을 수정해 다시 조회해 보세요.
          </p>
        </div>
      ) : !busy && !err ? (
        <p className="text-sm text-zinc-500">「가격 조회」를 누르면 친환경 조사가 결과가 여기에 표시됩니다.</p>
      ) : null}
    </div>
  );
}
