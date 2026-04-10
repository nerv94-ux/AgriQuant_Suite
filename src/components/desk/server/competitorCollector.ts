import type { DeskCompetitorTarget } from "@/components/desk/server/deskUserDraftQueries";

type SnapshotStatus = "SUCCESS" | "FAILED";

export type CompetitorCollectSnapshotInput = {
  targetId: string;
  label: string;
  source: string;
  productNo: string;
  url: string;
  canonicalUrl: string;
  price: number | null;
  optionPriceMin: number | null;
  optionPriceMax: number | null;
  soldOut: boolean | null;
  reviewCount: number | null;
  rating: number | null;
  status: SnapshotStatus;
  errorMessage: string;
  rawJson: string;
};

export type CompetitorCollectResult = {
  target: DeskCompetitorTarget;
  snapshot: CompetitorCollectSnapshotInput;
  attempts: number;
  retryUsed: boolean;
};

type CollectorAdapter = {
  supports(target: DeskCompetitorTarget): boolean;
  collect(target: DeskCompetitorTarget): Promise<CompetitorCollectSnapshotInput>;
};

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

class CollectError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "CollectError";
    this.retryable = retryable;
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function parseIntLoose(value: string): number | null {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseFloatLoose(value: string): number | null {
  const normalized = value.replace(/[^\d.]/g, "");
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

function pickByRegex(html: string, patterns: RegExp[], asFloat = false): number | null {
  for (const re of patterns) {
    const matched = html.match(re)?.[1];
    if (!matched) continue;
    const value = asFloat ? parseFloatLoose(matched) : parseIntLoose(matched);
    if (value !== null) return value;
  }
  return null;
}

function soldOutByRegex(html: string): boolean | null {
  if (/isSoldOut"\s*:\s*true/i.test(html)) return true;
  if (/soldOut"\s*:\s*true/i.test(html)) return true;
  if (/\"stockQty\"\s*:\s*0/i.test(html)) return true;
  if (/품절/i.test(html)) return true;
  if (/isSoldOut"\s*:\s*false/i.test(html)) return false;
  if (/soldOut"\s*:\s*false/i.test(html)) return false;
  return null;
}

function extractNaverFields(html: string) {
  const price = pickByRegex(html, [
    /"lowPrice"\s*:\s*"?(\\?\d[\d,]*)"?/i,
    /"price"\s*:\s*"?(\\?\d[\d,]*)"?/i,
    /"salePrice"\s*:\s*"?(\\?\d[\d,]*)"?/i,
  ]);
  const optionPriceMin = pickByRegex(html, [/"lowPrice"\s*:\s*"?(\\?\d[\d,]*)"?/i]);
  const optionPriceMax = pickByRegex(html, [/"highPrice"\s*:\s*"?(\\?\d[\d,]*)"?/i]);
  const reviewCount = pickByRegex(html, [
    /"reviewCount"\s*:\s*"?(\\?\d[\d,]*)"?/i,
    /"totalReviewCount"\s*:\s*"?(\\?\d[\d,]*)"?/i,
    /"buyerReviewCount"\s*:\s*"?(\\?\d[\d,]*)"?/i,
  ]);
  const rating = pickByRegex(
    html,
    [/"ratingValue"\s*:\s*"?(\\?\d+(?:\.\d+)?)"?/i, /"averageRating"\s*:\s*"?(\\?\d+(?:\.\d+)?)"?/i],
    true,
  );
  const soldOut = soldOutByRegex(html);
  return { price, optionPriceMin, optionPriceMax, reviewCount, rating, soldOut };
}

async function fetchHtml(url: string, timeoutMs = 10_000): Promise<{ status: number; finalUrl: string; html: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": DESKTOP_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Referer: "https://search.shopping.naver.com/",
      },
    });
    const html = await res.text();
    if (!res.ok) {
      const retryable = res.status >= 500 || res.status === 408;
      throw new CollectError(`HTTP_${res.status}`, retryable);
    }
    return { status: res.status, finalUrl: res.url || url, html };
  } catch (error) {
    if (error instanceof CollectError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new CollectError("TIMEOUT", true);
    }
    throw new CollectError(error instanceof Error ? error.message : "NETWORK_ERROR", true);
  } finally {
    clearTimeout(timer);
  }
}

const naverAdapter: CollectorAdapter = {
  supports(target) {
    return target.source === "NAVER" || /(?:smartstore|shopping)\.naver\.com/i.test(target.url || target.canonicalUrl);
  },
  async collect(target) {
    const url = target.url || target.canonicalUrl;
    if (!url) throw new CollectError("URL_EMPTY", false);
    const { finalUrl, html } = await fetchHtml(url);
    const extracted = extractNaverFields(html);
    const hasUsefulValue =
      extracted.price !== null ||
      extracted.optionPriceMin !== null ||
      extracted.optionPriceMax !== null ||
      extracted.reviewCount !== null ||
      extracted.rating !== null ||
      extracted.soldOut !== null;
    if (!hasUsefulValue) {
      throw new CollectError("PARSING_FAILED", false);
    }
    return {
      targetId: target.id,
      label: target.label,
      source: target.source,
      productNo: target.productNo,
      url: finalUrl,
      canonicalUrl: target.canonicalUrl,
      price: extracted.price,
      optionPriceMin: extracted.optionPriceMin,
      optionPriceMax: extracted.optionPriceMax,
      soldOut: extracted.soldOut,
      reviewCount: extracted.reviewCount,
      rating: extracted.rating,
      status: "SUCCESS",
      errorMessage: "",
      rawJson: JSON.stringify({
        provider: "NAVER",
        extracted,
      }),
    };
  },
};

const adapters: CollectorAdapter[] = [naverAdapter];

async function collectTarget(target: DeskCompetitorTarget, maxAttempts = 2): Promise<CompetitorCollectResult> {
  const adapter = adapters.find((item) => item.supports(target));
  if (!adapter) {
    return {
      target,
      attempts: 1,
      retryUsed: false,
      snapshot: {
        targetId: target.id,
        label: target.label,
        source: target.source,
        productNo: target.productNo,
        url: target.url,
        canonicalUrl: target.canonicalUrl,
        price: null,
        optionPriceMin: null,
        optionPriceMax: null,
        soldOut: null,
        reviewCount: null,
        rating: null,
        status: "FAILED",
        errorMessage: "UNSUPPORTED_SOURCE",
        rawJson: JSON.stringify({ source: target.source }),
      },
    };
  }

  let attempts = 0;
  let retryUsed = false;
  const safeAttempts = Math.max(1, Math.min(3, maxAttempts));
  while (attempts < safeAttempts) {
    attempts += 1;
    try {
      const snapshot = await adapter.collect(target);
      return { target, snapshot, attempts, retryUsed };
    } catch (error) {
      const collectError =
        error instanceof CollectError ? error : new CollectError(error instanceof Error ? error.message : "UNKNOWN", true);
      if (attempts < safeAttempts && collectError.retryable) {
        retryUsed = true;
        await sleep(400 * attempts);
        continue;
      }
      return {
        target,
        attempts,
        retryUsed,
        snapshot: {
          targetId: target.id,
          label: target.label,
          source: target.source,
          productNo: target.productNo,
          url: target.url,
          canonicalUrl: target.canonicalUrl,
          price: null,
          optionPriceMin: null,
          optionPriceMax: null,
          soldOut: null,
          reviewCount: null,
          rating: null,
          status: "FAILED",
          errorMessage: collectError.message,
          rawJson: JSON.stringify({ source: target.source, error: collectError.message }),
        },
      };
    }
  }

  return {
    target,
    attempts,
    retryUsed,
    snapshot: {
      targetId: target.id,
      label: target.label,
      source: target.source,
      productNo: target.productNo,
      url: target.url,
      canonicalUrl: target.canonicalUrl,
      price: null,
      optionPriceMin: null,
      optionPriceMax: null,
      soldOut: null,
      reviewCount: null,
      rating: null,
      status: "FAILED",
      errorMessage: "UNKNOWN",
      rawJson: JSON.stringify({ source: target.source, error: "UNKNOWN" }),
    },
  };
}

function cloneResultForTarget(base: CompetitorCollectResult, target: DeskCompetitorTarget): CompetitorCollectResult {
  return {
    target,
    attempts: base.attempts,
    retryUsed: base.retryUsed,
    snapshot: {
      ...base.snapshot,
      targetId: target.id,
      label: target.label,
      source: target.source,
      productNo: target.productNo,
      url: target.url || base.snapshot.url,
      canonicalUrl: target.canonicalUrl || base.snapshot.canonicalUrl,
    },
  };
}

function failedResult(target: DeskCompetitorTarget, errorMessage: string): CompetitorCollectResult {
  return {
    target,
    attempts: 0,
    retryUsed: false,
    snapshot: {
      targetId: target.id,
      label: target.label,
      source: target.source,
      productNo: target.productNo,
      url: target.url,
      canonicalUrl: target.canonicalUrl,
      price: null,
      optionPriceMin: null,
      optionPriceMax: null,
      soldOut: null,
      reviewCount: null,
      rating: null,
      status: "FAILED",
      errorMessage,
      rawJson: JSON.stringify({ source: target.source, error: errorMessage }),
    },
  };
}

function dedupeKey(target: DeskCompetitorTarget): string {
  const url = (target.canonicalUrl || target.url || "").trim().toLowerCase();
  const no = (target.productNo || "").trim();
  return `${target.source}|${no}|${url}`;
}

export async function collectEnabledCompetitorTargets(
  targets: DeskCompetitorTarget[],
  options?: {
    maxTargets?: number;
    perTargetDelayMs?: number;
    conservativeMode?: boolean;
    minJitterDelayMs?: number;
    maxJitterDelayMs?: number;
    maxAttempts?: number;
  },
): Promise<CompetitorCollectResult[]> {
  const conservativeMode = options?.conservativeMode === true;
  const maxTargets = Math.max(1, Math.min(50, Number(options?.maxTargets ?? 20)));
  const perTargetDelayMs = Math.max(0, Math.min(5000, Number(options?.perTargetDelayMs ?? 1200)));
  const minJitterDelayMs = Math.max(0, Math.min(120000, Number(options?.minJitterDelayMs ?? 0)));
  const maxJitterDelayMs = Math.max(minJitterDelayMs, Math.min(120000, Number(options?.maxJitterDelayMs ?? minJitterDelayMs)));
  const maxAttempts = Math.max(1, Math.min(3, Number(options?.maxAttempts ?? 2)));
  const enabled = targets
    .filter((row) => row.enabled)
    .slice(0, conservativeMode ? 1 : maxTargets);
  const results: CompetitorCollectResult[] = [];
  const cachedByKey = new Map<string, CompetitorCollectResult>();
  let blockedByRateLimit = false;
  if (conservativeMode && enabled.length > 0 && maxJitterDelayMs > 0) {
    const jitter = Math.floor(Math.random() * (maxJitterDelayMs - minJitterDelayMs + 1)) + minJitterDelayMs;
    await sleep(jitter);
  }
  for (let i = 0; i < enabled.length; i += 1) {
    const item = enabled[i];
    if (blockedByRateLimit) {
      results.push(failedResult(item, "RATE_LIMITED_SKIPPED"));
      continue;
    }

    const key = dedupeKey(item);
    const cached = cachedByKey.get(key);
    if (cached) {
      results.push(cloneResultForTarget(cached, item));
      continue;
    }

    const result = await collectTarget(item, conservativeMode ? 1 : maxAttempts);
    cachedByKey.set(key, result);
    results.push(result);
    if (result.snapshot.errorMessage === "HTTP_429") {
      blockedByRateLimit = true;
    }
    if (i < enabled.length - 1 && perTargetDelayMs > 0) {
      await sleep(perTargetDelayMs);
    }
  }
  return results;
}
