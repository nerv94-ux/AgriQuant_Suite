export type CompetitorSource = "NAVER" | "COUPANG" | "GMARKET" | "ELEVENST" | "UNKNOWN";

export type CompetitorTargetShape = {
  id: string;
  label: string;
  url: string;
  productNo: string;
  enabled: boolean;
  createdAt: string;
  source?: CompetitorSource;
  canonicalUrl?: string;
  needsManualReview?: boolean;
  lastSyncLog?: CompetitorSyncLog;
};

export type CompetitorSyncLog = {
  checkedAt: string;
  originalUrl: string;
  finalUrl: string;
  statusCode: number | null;
  method: "HEAD" | "GET" | "NONE";
  healthy: boolean;
  repaired: boolean;
  repairReason: string;
  redirected: boolean;
  error: string;
  manualReviewRequired: boolean;
};

function normalizeUrlText(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    u.hash = "";
    return u.toString();
  } catch {
    return raw;
  }
}

function detectSourceFromUrl(url: string): CompetitorSource {
  const u = url.toLowerCase();
  if (u.includes("smartstore.naver.com") || u.includes("shopping.naver.com")) return "NAVER";
  if (u.includes("coupang.com")) return "COUPANG";
  if (u.includes("gmarket.co.kr")) return "GMARKET";
  if (u.includes("11st.co.kr")) return "ELEVENST";
  return "UNKNOWN";
}

function digits(value: string): string {
  return value.replace(/\D+/g, "");
}

function isReachableStatus(statusCode: number): boolean {
  if (statusCode >= 200 && statusCode < 400) return true;
  if (statusCode === 401 || statusCode === 403 || statusCode === 429) return true;
  return false;
}

type ProbeResult = {
  ok: boolean;
  statusCode: number | null;
  finalUrl: string;
  method: "HEAD" | "GET";
  error: string;
};

async function probeUrl(url: string, timeoutMs: number): Promise<ProbeResult> {
  const methods: Array<"HEAD" | "GET"> = ["HEAD", "GET"];
  let lastError = "";
  for (const method of methods) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (method === "HEAD" && res.status === 405) {
        lastError = "HEAD_NOT_ALLOWED";
        continue;
      }
      return {
        ok: isReachableStatus(res.status),
        statusCode: res.status,
        finalUrl: normalizeUrlText(res.url || url),
        method,
        error: "",
      };
    } catch (error) {
      clearTimeout(timer);
      lastError = error instanceof Error ? error.message : "REQUEST_FAILED";
    }
  }
  return {
    ok: false,
    statusCode: null,
    finalUrl: normalizeUrlText(url),
    method: "GET",
    error: lastError || "REQUEST_FAILED",
  };
}

function parseProductNoBySource(url: string, source: CompetitorSource): string {
  if (!url) return "";
  const safe = normalizeUrlText(url);
  try {
    const u = new URL(safe);
    const path = u.pathname;
    if (source === "NAVER") {
      const byCatalog = path.match(/\/catalog\/(\d+)/i)?.[1];
      if (byCatalog) return byCatalog;
      const byProducts = path.match(/\/products\/(\d+)/i)?.[1];
      if (byProducts) return byProducts;
      const byNvMid = u.searchParams.get("nvMid");
      if (byNvMid) return digits(byNvMid);
      return "";
    }
    if (source === "COUPANG") {
      const byVp = path.match(/\/vp\/products\/(\d+)/i)?.[1];
      if (byVp) return byVp;
      const byProduct = u.searchParams.get("productId");
      if (byProduct) return digits(byProduct);
      return "";
    }
    if (source === "GMARKET") {
      const byGoodscode = u.searchParams.get("goodscode");
      if (byGoodscode) return digits(byGoodscode);
      const byPath = path.match(/\/item\/(\d+)/i)?.[1];
      if (byPath) return byPath;
      return "";
    }
    if (source === "ELEVENST") {
      const byProducts = path.match(/\/products\/(\d+)/i)?.[1];
      if (byProducts) return byProducts;
      const byPrdNo = u.searchParams.get("prdNo");
      if (byPrdNo) return digits(byPrdNo);
      return "";
    }
  } catch {
    return "";
  }
  return "";
}

export function buildCanonicalUrl(source: CompetitorSource, productNo: string): string {
  const no = digits(productNo.trim());
  if (!no) return "";
  if (source === "NAVER") return `https://search.shopping.naver.com/catalog/${no}`;
  if (source === "COUPANG") return `https://www.coupang.com/vp/products/${no}`;
  if (source === "GMARKET") return `https://item.gmarket.co.kr/Item?goodscode=${no}`;
  if (source === "ELEVENST") return `https://www.11st.co.kr/products/${no}`;
  return "";
}

export function autoFillCompetitorTarget(input: CompetitorTargetShape): CompetitorTargetShape {
  const normalizedUrl = normalizeUrlText(input.url);
  const detected = detectSourceFromUrl(normalizedUrl);
  const source: CompetitorSource = input.source && input.source !== "UNKNOWN" ? input.source : detected;
  const parsedNo = parseProductNoBySource(normalizedUrl, source);
  const productNo = digits(input.productNo.trim()) || parsedNo;
  const canonicalUrl = buildCanonicalUrl(source, productNo);
  const url = normalizedUrl || canonicalUrl;
  return {
    ...input,
    label: input.label.trim(),
    productNo,
    source,
    canonicalUrl,
    url,
    needsManualReview: input.needsManualReview === true,
    lastSyncLog: input.lastSyncLog,
  };
}

export async function checkAndRepairCompetitorTarget(
  input: CompetitorTargetShape,
  options?: { timeoutMs?: number },
): Promise<{ target: CompetitorTargetShape; log: CompetitorSyncLog }> {
  const timeoutMs = Math.max(2000, Math.min(20000, Number(options?.timeoutMs ?? 7000)));
  const normalized = autoFillCompetitorTarget(input);
  const originalUrl = normalizeUrlText(normalized.url);
  const checkedAt = new Date().toISOString();
  const fallbackCanonical = normalized.canonicalUrl || buildCanonicalUrl(normalized.source ?? "UNKNOWN", normalized.productNo);
  const primaryUrl = originalUrl || fallbackCanonical;

  if (!primaryUrl) {
    const log: CompetitorSyncLog = {
      checkedAt,
      originalUrl: "",
      finalUrl: "",
      statusCode: null,
      method: "NONE",
      healthy: false,
      repaired: false,
      repairReason: "NO_URL_AND_NO_CANONICAL",
      redirected: false,
      error: "URL_OR_PRODUCTNO_REQUIRED",
      manualReviewRequired: true,
    };
    return { target: { ...normalized, needsManualReview: true, lastSyncLog: log }, log };
  }

  const firstProbe = await probeUrl(primaryUrl, timeoutMs);
  if (firstProbe.ok) {
    const finalUrl = firstProbe.finalUrl || primaryUrl;
    const log: CompetitorSyncLog = {
      checkedAt,
      originalUrl: primaryUrl,
      finalUrl,
      statusCode: firstProbe.statusCode,
      method: firstProbe.method,
      healthy: true,
      repaired: finalUrl !== primaryUrl,
      repairReason: finalUrl !== primaryUrl ? "REDIRECT_UPDATED" : "HEALTHY",
      redirected: finalUrl !== primaryUrl,
      error: "",
      manualReviewRequired: false,
    };
    return {
      target: autoFillCompetitorTarget({
        ...normalized,
        url: finalUrl,
        needsManualReview: false,
        lastSyncLog: log,
      }),
      log,
    };
  }

  const repairUrl = fallbackCanonical && fallbackCanonical !== primaryUrl ? fallbackCanonical : "";
  if (repairUrl) {
    const repairProbe = await probeUrl(repairUrl, timeoutMs);
    if (repairProbe.ok) {
      const finalUrl = repairProbe.finalUrl || repairUrl;
      const log: CompetitorSyncLog = {
        checkedAt,
        originalUrl: primaryUrl,
        finalUrl,
        statusCode: repairProbe.statusCode,
        method: repairProbe.method,
        healthy: true,
        repaired: true,
        repairReason: "CANONICAL_RECOVERED",
        redirected: finalUrl !== repairUrl,
        error: firstProbe.error,
        manualReviewRequired: false,
      };
      return {
        target: autoFillCompetitorTarget({
          ...normalized,
          url: finalUrl,
          needsManualReview: false,
          lastSyncLog: log,
        }),
        log,
      };
    }
  }

  const failedLog: CompetitorSyncLog = {
    checkedAt,
    originalUrl: primaryUrl,
    finalUrl: primaryUrl,
    statusCode: firstProbe.statusCode,
    method: firstProbe.method,
    healthy: false,
    repaired: false,
    repairReason: repairUrl ? "RECOVERY_FAILED" : "NO_RECOVERY_CANDIDATE",
    redirected: false,
    error: firstProbe.error,
    manualReviewRequired: true,
  };
  return {
    target: {
      ...normalized,
      needsManualReview: true,
      lastSyncLog: failedLog,
    },
    log: failedLog,
  };
}

