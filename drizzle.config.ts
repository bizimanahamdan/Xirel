import path from "node:path";
import { defineConfig } from "drizzle-kit";

const databaseFile =
  process.env.DATABASE_FILE ?? path.resolve(process.cwd(), "data", "store.db");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: databaseFile,
  },
});
