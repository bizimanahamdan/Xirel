import path from "node:path";

export const ENV = {
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  isProduction: process.env.NODE_ENV === "production",
  databaseFile: process.env.DATABASE_FILE ?? path.resolve(process.cwd(), "data", "store.db"),
  uploadsDir: process.env.UPLOADS_DIR ?? path.resolve(process.cwd(), "data", "uploads"),
  // If set, only this exact email can ever become admin via registration.
  // Leave unset for local/offline use, where "first user wins" is fine.
  adminEmail: process.env.ADMIN_EMAIL ?? "",
};
