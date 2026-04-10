import { mafraSmallCodesMatch } from "@/components/common/api/server/connectors/mafra/normalizeMafraSmallMatch";
import type { MafraRealtimeAuctionItem } from "@/components/common/api/server/connectors/mafra-rltm-auc-info/types";

/**
 * 데스크 품목 기준: 저장된 LARGE·MID·SMALL과 응답 행을 맞춤.
 * 짧은 SMALL(예: `01`)만으로는 여러 품목에 걸릴 수 있어, DB에 대·중이 있으면 함께 본다.
 */
export function filterRealtimeAuctionRowsByDeskItem(
  rows: MafraRealtimeAuctionItem[],
  opts: { small: string; large?: string | null; mid?: string | null },
): MafraRealtimeAuctionItem[] {
  const s = opts.small.trim();
  if (!s) return [];
  const L = opts.large?.trim() ?? "";
  const M = opts.mid?.trim() ?? "";
  return rows.filter((r) => {
    if (!mafraSmallCodesMatch(s, String(r.SMALL ?? ""))) return false;
    if (L && String(r.LARGE ?? "").trim() !== L) return false;
    if (M && String(r.MID ?? "").trim() !== M) return false;
    return true;
  });
}
