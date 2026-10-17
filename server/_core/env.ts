import path from "node:path";

const DEVELOPMENT_JWT_SECRET =
  "xirel-development-only-fallback-not-for-production-2026";
const TEST_JWT_SECRET =
  "xirel-test-only-session-secret-not-for-production-2026";

const INSECURE_JWT_SECRETS = new Set([
  "dev-secret-change-me",
  "change-me-to-a-long-random-string",
  "change-me",
  "changeme",
  "secret",
  "jwt-secret",
  "your-secret",
  "your-jwt-secret",
  "your-secret-key",
  "password",
  "password123",
  "default",
  "placeholder",
  "example-secret",
]);

export class JwtSecretConfigurationError extends Error {
  readonly code = "JWT_SECRET_CONFIGURATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "JwtSecretConfigurationError";
  }
}

function validateProductionJwtSecret(secret: string | undefined): string {
  const normalized = secret?.trim();

  if (!normalized) {
    throw new JwtSecretConfigurationError(
      "JWT_SECRET is required when NODE_ENV=production."
    );
  }

  const lower = normalized.toLowerCase();
  const hasPlaceholderWords =
    /(?:change[-_ ]?me|your[-_ ]?(?:jwt[-_ ]?)?secret|placeholder|example[-_ ]?secret|dev[-_ ]?secret|(?:^|[-_ ])(?:secret|password|default)(?:$|[-_ ]))/i.test(
      normalized
    );
  const repeatedPattern =
    /^(.)\1+$/.test(normalized) || /^(.{1,8})\1+$/.test(normalized);
  const predictableSequence =
    /(?:abcdefghijklmnopqrstuvwxyz|zyxwvutsrqponmlkjihgfedcba|0123456789|9876543210)/i.test(
      normalized
    );
  const distinctCharacterCount = new Set(normalized).size;

  if (
    INSECURE_JWT_SECRETS.has(lower) ||
    hasPlaceholderWords ||
    repeatedPattern ||
    predictableSequence ||
    normalized.length < 32 ||
    Buffer.byteLength(normalized, "utf8") < 32 ||
    distinctCharacterCount < 16
  ) {
    throw new JwtSecretConfigurationError(
      "JWT_SECRET must be a non-placeholder secret with at least 32 UTF-8 bytes and sufficient character variety."
    );
  }

  return normalized;
}

/** Resolve the session signing key without ever including its value in errors or logs. */
export function resolveJwtSecret(
  nodeEnv: string | undefined,
  configuredSecret: string | undefined,
  warn: (message: string) => void = message => console.warn(message)
): string {
  if (nodeEnv === "production") {
    return validateProductionJwtSecret(configuredSecret);
  }

  const configured = configuredSecret?.trim();
  if (configured) return configured;

  if (nodeEnv === "test") return TEST_JWT_SECRET;

  warn(
    "JWT_SECRET is not set; using a development-only session key. Never use this fallback in production."
  );
  return DEVELOPMENT_JWT_SECRET;
}

function readPositiveInteger(
  name: string,
  rawValue: string | undefined,
  fallback: number,
  max: number
): number {
  if (rawValue === undefined || rawValue.trim() === "") return fallback;
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}.`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === "production";
const configuredAdminEmail =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
if (
  configuredAdminEmail &&
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredAdminEmail)
) {
  throw new Error("ADMIN_EMAIL must be a valid email address when set.");
}

const sessionTtlDays = readPositiveInteger(
  "SESSION_TTL_DAYS",
  process.env.SESSION_TTL_DAYS,
  7,
  30
);
const trustProxyHops =
  process.env.TRUST_PROXY_HOPS === undefined ||
  process.env.TRUST_PROXY_HOPS.trim() === ""
    ? isProduction
      ? 1
      : 0
    : Number(process.env.TRUST_PROXY_HOPS);
if (
  !Number.isSafeInteger(trustProxyHops) ||
  trustProxyHops < 0 ||
  trustProxyHops > 10
) {
  throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 10.");
}

const sessionCookieDomain = process.env.SESSION_COOKIE_DOMAIN?.trim() ?? "";
if (sessionCookieDomain && !/^\.?[a-z0-9.-]+$/i.test(sessionCookieDomain)) {
  throw new Error(
    "SESSION_COOKIE_DOMAIN must be a hostname (without a scheme or path)."
  );
}

export const ENV = {
  jwtSecret: resolveJwtSecret(process.env.NODE_ENV, process.env.JWT_SECRET),
  isProduction,
  sessionTtlDays,
  sessionTtlMs: sessionTtlDays * 24 * 60 * 60 * 1000,
  sessionCookieDomain,
  trustProxyHops,
  // Local file fallback — used automatically when TURSO_DATABASE_URL isn't set,
  // so the app still runs fully offline with zero configuration.
  databaseFile:
    process.env.DATABASE_FILE ??
    path.resolve(process.cwd(), "data", "store.db"),
  // If set, only this exact email can ever be bootstrapped as an admin. No
  // first-public-user promotion is performed when it is absent.
  adminEmail: configuredAdminEmail,
  // Set these to use a free hosted Turso (libSQL) database instead — required
  // for any host whose local filesystem doesn't persist (most free tiers).
  tursoUrl: process.env.TURSO_DATABASE_URL ?? "",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN ?? "",
  // Optional: real image hosting via Cloudinary. If any of these are unset,
  // storage.ts falls back to storing images as inline base64 data URIs
  // directly in the database — works with zero setup, but bloats the DB and
  // page size, so Cloudinary is recommended for a real deployment.
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  // Optional: powers the AI support chat on the Support page. Get a free key
  // (no credit card) at console.groq.com. If unset, the chat widget shows a
  // "not available yet, use WhatsApp" message instead of erroring.
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  // Optional: powers Printify product import + auto order placement. Get a
  // Personal Access Token from Printify account settings; the shop ID is
  // fetched via the admin panel once the token is set.
  printifyApiToken: process.env.PRINTIFY_API_TOKEN ?? "",
  printifyShopId: process.env.PRINTIFY_SHOP_ID ?? "",
  // Optional: MTN MoMo Collections (Request to Pay) for real-time checkout
  // payment. Get these from momodeveloper.mtn.co.rw (Rwanda) after your
  // Collections product is approved. If unset, checkout falls back to
  // creating a pending order for manual payment confirmation.
  momoApiUser: process.env.MOMO_API_USER ?? "",
  momoApiKey: process.env.MOMO_API_KEY ?? "",
  momoSubscriptionKey: process.env.MOMO_SUBSCRIPTION_KEY ?? "",
  momoTargetEnvironment: process.env.MOMO_TARGET_ENVIRONMENT ?? "mtnrwanda",
  momoBaseUrl:
    process.env.MOMO_BASE_URL ?? "https://sandbox.momodeveloper.mtn.com",
  // MTN's sandbox rejects any currency except EUR, while production expects
  // the real local currency. See momo.ts for how this is applied.
  momoCurrency: process.env.MOMO_CURRENCY || "RWF",
  // Optional: CJ Dropshipping. Get an API Key from CJ's Personal Center >
  // API tab > Add API. Unlike Printify's static token, CJ's access token
  // expires and is refreshed automatically (cached in the database).
  cjApiKey: process.env.CJ_API_KEY ?? "",
  // Optional: AI-generated cinematic showcase videos per product. Get an
  // API key + secret from cloud.higgsfield.ai.
  higgsfieldApiKey: process.env.HIGGSFIELD_API_KEY ?? "",
  higgsfieldApiSecret: process.env.HIGGSFIELD_API_SECRET ?? "",
};
