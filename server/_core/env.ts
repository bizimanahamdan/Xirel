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
};
