import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * Local users table. Auth is email + password (bcrypt hash) — no external
 * OAuth provider required. The very first account created becomes admin.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  name: text("name"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Product categories: Electronics and Outfits
 */
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

/**
 * Products with pricing, stock, and category association
 */
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  price: text("price").notNull(),
  categoryId: integer("categoryId").notNull(),
  stock: integer("stock").default(0).notNull(),
  imageUrl: text("imageUrl"),
  imageKey: text("imageKey"),
  // Full gallery for the product detail page's slider. imageUrl above stays
  // as the quick "thumbnail" used in lists/cards — images[0] is normally the
  // same picture, but imageUrl is kept separate so older products (created
  // before this existed) still work with just a single image.
  images: text("images", { mode: "json" }).$type<string[]>(),
  // AI-generated cinematic showcase video (Higgsfield), if one has been made.
  showcaseVideoUrl: text("showcaseVideoUrl"),
  sku: text("sku").unique(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  // Links this product to a print-on-demand/dropshipping provider's exact
  // product+variant, so an order for it can be auto-placed with them.
  dropshipProvider: text("dropshipProvider", { enum: ["printify", "cj"] }),
  dropshipProductId: text("dropshipProductId"),
  dropshipVariantId: text("dropshipVariantId"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Shopping cart items per user
 */
export const cartItems = sqliteTable("cartItems", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  productId: integer("productId").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

/**
 * Orders with shipping and payment information
 */
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  orderNumber: text("orderNumber").notNull().unique(),
  status: text("status", {
    enum: ["pending", "paid", "processing", "shipped", "delivered", "cancelled"],
  })
    .default("pending")
    .notNull(),
  totalAmount: text("totalAmount").notNull(),
  shippingAddress: text("shippingAddress", { mode: "json" }).$type<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }>(),
  paymentMethod: text("paymentMethod"),
  stripePaymentIntentId: text("stripePaymentIntentId"),
  // Generic external payment reference — e.g. an MTN MoMo requestToPay
  // referenceId, used to poll/confirm payment status.
  paymentReference: text("paymentReference"),
  items: text("items", { mode: "json" }).$type<
    Array<{
      productId: number;
      name: string;
      price: string;
      quantity: number;
    }>
  >(),
  // Records what happened when we tried to auto-place this order with a
  // dropship provider (Printify, CJ, etc.) — one entry per linked line item.
  fulfillments: text("fulfillments", { mode: "json" }).$type<
    Array<{
      provider: "printify" | "cj";
      productId: number;
      externalOrderId?: string;
      status: "placed" | "failed";
      error?: string;
      createdAt: string;
    }>
  >(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Payment settings for admin configuration.
 * Stripe is entirely optional — leave disabled to run 100% offline.
 */
export const paymentSettings = sqliteTable("paymentSettings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stripePublishableKey: text("stripePublishableKey"),
  stripeSecretKey: text("stripeSecretKey"),
  stripeEnabled: integer("stripeEnabled", { mode: "boolean" }).default(false).notNull(),
  paypalEnabled: integer("paypalEnabled", { mode: "boolean" }).default(false).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type PaymentSettings = typeof paymentSettings.$inferSelect;
export type InsertPaymentSettings = typeof paymentSettings.$inferInsert;

/**
 * Lightweight, anonymous analytics: one row per page view, search, or
 * category view. `resultCount` is null for plain page views, and the actual
 * product count for search/category_view events — a resultCount of 0 is a
 * "customer found nothing" event, which the admin analytics page highlights.
 */
export const analyticsEvents = sqliteTable("analyticsEvents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventType: text("eventType", { enum: ["page_view", "search", "category_view"] }).notNull(),
  path: text("path").notNull(),
  query: text("query"),
  categorySlug: text("categorySlug"),
  resultCount: integer("resultCount"),
  device: text("device", { enum: ["mobile", "tablet", "desktop", "unknown"] })
    .notNull()
    .default("unknown"),
  browser: text("browser").notNull().default("unknown"),
  os: text("os").notNull().default("unknown"),
  userAgent: text("userAgent"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

/**
 * Persisted OAuth-style tokens for integrations whose credentials expire and
 * need refreshing (e.g. CJ Dropshipping). Persisted rather than kept only in
 * memory so a server restart doesn't force a fresh re-auth every time.
 */
export const integrationTokens = sqliteTable("integrationTokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull().unique(),
  accessToken: text("accessToken").notNull(),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }).notNull(),
  refreshToken: text("refreshToken"),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type IntegrationToken = typeof integrationTokens.$inferSelect;
