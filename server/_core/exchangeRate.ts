// Converts USD product prices (how this store's catalog is priced) to RWF
// (what MTN MoMo actually charges in). Uses a free, no-key exchange rate
// API with a short in-memory cache, and falls back to a fixed rate if that
// API is ever unreachable or misbehaves — checkout should never hard-fail
// just because a third-party rate lookup had a bad moment.

const FALLBACK_USD_TO_RWF = 1460;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedRate: { value: number; source: "live" | "fallback"; expiresAt: number } | null = null;

async function fetchLiveUsdToRwfRate(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    const rate = data?.rates?.RWF;

    return typeof rate === "number" && rate > 0 ? rate : null;
  } catch (error) {
    console.error("Live exchange rate fetch failed, using fallback rate:", error);
    return null;
  }
}

export async function getUsdToRwfRate(): Promise<{ rate: number; source: "live" | "fallback" }> {
  if (cachedRate && cachedRate.expiresAt > Date.now()) {
    return { rate: cachedRate.value, source: cachedRate.source };
  }

  const liveRate = await fetchLiveUsdToRwfRate();
  const rate = liveRate ?? FALLBACK_USD_TO_RWF;
  const source: "live" | "fallback" = liveRate ? "live" : "fallback";

  cachedRate = { value: rate, source, expiresAt: Date.now() + CACHE_TTL_MS };
  return { rate, source };
}

/** Converts a USD amount (as stored in product/order prices) to a whole-number RWF amount. */
export async function convertUsdToRwf(usdAmount: number): Promise<{
  rwfAmount: number;
  rate: number;
  source: "live" | "fallback";
}> {
  const { rate, source } = await getUsdToRwfRate();
  const rwfAmount = Math.round(usdAmount * rate);
  return { rwfAmount, rate, source };
}
