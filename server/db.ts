import { eq, and, like, gte, lte, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import {
  users,
  categories,
  products,
  cartItems,
  orders,
  paymentSettings,
  analyticsEvents,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Lazily creates (and, on first run, initializes) the database connection.
 *
 * - If TURSO_DATABASE_URL is set, connects to a free hosted Turso (libSQL)
 *   database — the right choice for any host whose local filesystem doesn't
 *   persist across restarts/redeploys (most free-tier PaaS hosting).
 * - Otherwise, falls back to a local SQLite file — zero configuration
 *   needed for local/offline use.
 */
export function getDb() {
  if (_db) return _db;

  if (!ENV.tursoUrl) {
    fs.mkdirSync(path.dirname(ENV.databaseFile), { recursive: true });
  }

  const client = ENV.tursoUrl
    ? createClient({ url: ENV.tursoUrl, authToken: ENV.tursoAuthToken || undefined })
    : createClient({ url: `file:${ENV.databaseFile}` });

  _db = drizzle(client);

  // Fire off schema creation; safe to call every boot ("IF NOT EXISTS").
  void ensureSchema(client);

  return _db;
}

let schemaReadyPromise: Promise<void> | null = null;

/** Awaitable guarantee that tables exist before the first query runs. */
function ensureSchema(client: ReturnType<typeof createClient>): Promise<void> {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
      lastSignedIn INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      slug TEXT NOT NULL UNIQUE,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price TEXT NOT NULL,
      categoryId INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      imageUrl TEXT,
      imageKey TEXT,
      sku TEXT UNIQUE,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS cartItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      orderNumber TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      totalAmount TEXT NOT NULL,
      shippingAddress TEXT,
      paymentMethod TEXT,
      stripePaymentIntentId TEXT,
      items TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS paymentSettings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stripePublishableKey TEXT,
      stripeSecretKey TEXT,
      stripeEnabled INTEGER NOT NULL DEFAULT 0,
      paypalEnabled INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS analyticsEvents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventType TEXT NOT NULL,
      path TEXT NOT NULL,
      query TEXT,
      categorySlug TEXT,
      resultCount INTEGER,
      device TEXT NOT NULL DEFAULT 'unknown',
      browser TEXT NOT NULL DEFAULT 'unknown',
      os TEXT NOT NULL DEFAULT 'unknown',
      userAgent TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `).then(() => undefined);

  return schemaReadyPromise;
}

/** Every exported function awaits this before touching the DB, so callers
 * never race the first-boot table creation (matters most on a cold Turso
 * connection where creation is a real network round-trip). */
async function ready() {
  const db = getDb();
  await schemaReadyPromise;
  return db;
}

// ============ USERS ============

export async function createUser(data: {
  email: string;
  passwordHash: string;
  name?: string | null;
  role?: "user" | "admin";
}) {
  const db = await ready();
  const [row] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name ?? null,
      role: data.role ?? "user",
    })
    .returning();
  return row;
}

export async function touchLastSignedIn(userId: number) {
  const db = await ready();
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function getUserByEmail(email: string) {
  const db = await ready();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await ready();
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await ready();
  return db.select().from(users);
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await ready();
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return getUserById(userId);
}

// ============ CATEGORIES ============

export async function getAllCategories() {
  const db = await ready();
  return db.select().from(categories);
}

export async function getCategoryBySlug(slug: string) {
  const db = await ready();
  const result = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCategoryById(id: number) {
  const db = await ready();
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCategory(data: { name: string; slug: string; description?: string }) {
  const db = await ready();
  const [row] = await db.insert(categories).values(data).returning();
  return row;
}

// ============ PRODUCTS ============

export async function getAllProducts(filters?: {
  categoryId?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
}) {
  const db = await ready();

  const conditions = [eq(products.isActive, true)];

  if (filters?.categoryId) {
    conditions.push(eq(products.categoryId, filters.categoryId));
  }
  if (filters?.search) {
    conditions.push(like(products.name, `%${filters.search}%`));
  }
  if (filters?.minPrice !== undefined) {
    conditions.push(gte(products.price, filters.minPrice.toString()));
  }
  if (filters?.maxPrice !== undefined) {
    conditions.push(lte(products.price, filters.maxPrice.toString()));
  }

  return db
    .select()
    .from(products)
    .where(and(...conditions));
}

export async function getProductById(id: number) {
  const db = await ready();
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(data: {
  name: string;
  description?: string;
  price: string;
  categoryId: number;
  stock: number;
  imageUrl?: string;
  imageKey?: string;
  sku?: string;
}) {
  const db = await ready();
  const [row] = await db.insert(products).values(data).returning();
  return row;
}

export async function updateProduct(
  id: number,
  data: Partial<{
    name: string;
    description: string;
    price: string;
    categoryId: number;
    stock: number;
    imageUrl: string;
    imageKey: string;
    sku: string;
    isActive: boolean;
  }>
) {
  const db = await ready();
  await db.update(products).set(data).where(eq(products.id, id));
  return getProductById(id);
}

export async function deleteProduct(id: number) {
  const db = await ready();
  await db.update(products).set({ isActive: false }).where(eq(products.id, id));
  return true;
}

// ============ CART ============

export async function getCartItems(userId: number) {
  const db = await ready();
  return db.select().from(cartItems).where(eq(cartItems.userId, userId));
}

export async function getCartItemById(cartItemId: number) {
  const db = await ready();
  const result = await db.select().from(cartItems).where(eq(cartItems.id, cartItemId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function addToCart(userId: number, productId: number, quantity: number) {
  const db = await ready();

  const existing = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(cartItems)
      .set({ quantity: existing[0].quantity + quantity })
      .where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({ userId, productId, quantity });
  }

  return getCartItems(userId);
}

export async function updateCartItemQuantity(cartItemId: number, quantity: number) {
  const db = await ready();

  if (quantity <= 0) {
    await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
  } else {
    await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, cartItemId));
  }

  return true;
}

export async function removeFromCart(cartItemId: number) {
  const db = await ready();
  await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
  return true;
}

export async function clearCart(userId: number) {
  const db = await ready();
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
  return true;
}

// ============ ORDERS ============

export async function createOrder(data: {
  userId: number;
  orderNumber: string;
  totalAmount: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  paymentMethod?: string;
  stripePaymentIntentId?: string;
  items: Array<{ productId: number; name: string; price: string; quantity: number }>;
}) {
  const db = await ready();
  const [row] = await db.insert(orders).values(data).returning();
  return row;
}

export async function getOrderById(id: number) {
  const db = await ready();
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserOrders(userId: number) {
  const db = await ready();
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function getAllOrders() {
  const db = await ready();
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function updateOrderStatus(
  id: number,
  status: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled"
) {
  const db = await ready();
  await db.update(orders).set({ status }).where(eq(orders.id, id));
  return getOrderById(id);
}

// ============ PAYMENT SETTINGS ============

export async function getPaymentSettings() {
  const db = await ready();
  const result = await db.select().from(paymentSettings).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updatePaymentSettings(
  data: Partial<{
    stripePublishableKey: string;
    stripeSecretKey: string;
    stripeEnabled: boolean;
    paypalEnabled: boolean;
  }>
) {
  const db = await ready();
  const existing = await getPaymentSettings();

  if (existing) {
    await db.update(paymentSettings).set(data).where(eq(paymentSettings.id, existing.id));
    return getPaymentSettings();
  }

  const [row] = await db.insert(paymentSettings).values(data).returning();
  return row ?? null;
}

// ============ ANALYTICS ============

export async function logAnalyticsEvent(data: {
  eventType: "page_view" | "search" | "category_view";
  path: string;
  query?: string | null;
  categorySlug?: string | null;
  resultCount?: number | null;
  device: "mobile" | "tablet" | "desktop" | "unknown";
  browser: string;
  os: string;
  userAgent?: string | null;
}) {
  const db = await ready();
  await db.insert(analyticsEvents).values(data);
}

/** High-level counts for the admin analytics dashboard, covering the last N days. */
export async function getAnalyticsSummary(days = 30) {
  const db = await ready();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const totalViews = await db
    .select({ count: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.eventType, "page_view"), gte(analyticsEvents.createdAt, since)));

  const byDevice = await db
    .select({ device: analyticsEvents.device, count: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(analyticsEvents.device);

  const byBrowser = await db
    .select({ browser: analyticsEvents.browser, count: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(analyticsEvents.browser)
    .orderBy(desc(sql`count(*)`));

  const byOs = await db
    .select({ os: analyticsEvents.os, count: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(analyticsEvents.os)
    .orderBy(desc(sql`count(*)`));

  const topPaths = await db
    .select({ path: analyticsEvents.path, count: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.eventType, "page_view"), gte(analyticsEvents.createdAt, since)))
    .groupBy(analyticsEvents.path)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return {
    totalViews: Number(totalViews[0]?.count ?? 0),
    byDevice: byDevice.map(r => ({ device: r.device, count: Number(r.count) })),
    byBrowser: byBrowser.map(r => ({ browser: r.browser, count: Number(r.count) })),
    byOs: byOs.map(r => ({ os: r.os, count: Number(r.count) })),
    topPaths: topPaths.map(r => ({ path: r.path, count: Number(r.count) })),
  };
}

/** Search terms and category views that came up empty — the actionable
 * "customers looked for X and found nothing" list. */
export async function getEmptyResultEvents(days = 30) {
  const db = await ready();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const emptySearches = await db
    .select({ query: analyticsEvents.query, count: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.eventType, "search"),
        eq(analyticsEvents.resultCount, 0),
        gte(analyticsEvents.createdAt, since)
      )
    )
    .groupBy(analyticsEvents.query)
    .orderBy(desc(sql`count(*)`))
    .limit(50);

  const emptyCategoryViews = await db
    .select({ categorySlug: analyticsEvents.categorySlug, count: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.eventType, "category_view"),
        eq(analyticsEvents.resultCount, 0),
        gte(analyticsEvents.createdAt, since)
      )
    )
    .groupBy(analyticsEvents.categorySlug)
    .orderBy(desc(sql`count(*)`))
    .limit(50);

  return {
    emptySearches: emptySearches.map(r => ({ query: r.query ?? "(empty)", count: Number(r.count) })),
    emptyCategoryViews: emptyCategoryViews.map(r => ({
      categorySlug: r.categorySlug ?? "(unknown)",
      count: Number(r.count),
    })),
  };
}
