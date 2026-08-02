import path from "node:path";

export const ENV = {
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  isProduction: process.env.NODE_ENV === "production",
  // Local file fallback — used automatically when TURSO_DATABASE_URL isn't set,
  // so the app still runs fully offline with zero configuration.
  databaseFile: process.env.DATABASE_FILE ?? path.resolve(process.cwd(), "data", "store.db"),
  // Set these to use a free hosted Turso (libSQL) database instead — required
  // for any host whose local filesystem doesn't persist (most free tiers).
  tursoUrl: process.env.TURSO_DATABASE_URL ?? "",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN ?? "",
  // If set, only this exact email can ever become admin. Leave unset for
  // local/offline use, where "first user wins" is fine.
  adminEmail: process.env.ADMIN_EMAIL ?? "",
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
  momoBaseUrl: process.env.MOMO_BASE_URL ?? "https://sandbox.momodeveloper.mtn.com",
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
