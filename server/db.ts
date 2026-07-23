import { eq, and, like, gte, lte, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  users,
  categories,
  products,
  cartItems,
  orders,
  paymentSettings,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Lazily creates (and, on first run, initializes) the local SQLite database.
 * No network access or external database server is required.
 */
export function getDb() {
  if (_db) return _db;

  const dir = path.dirname(ENV.databaseFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(ENV.databaseFile);
  sqlite.pragma("journal_mode = WAL");
  _db = drizzle(sqlite);

  ensureSchema(sqlite);

  return _db;
}

/**
 * Creates tables if they don't already exist. This lets the app boot with a
 * single `npm run dev` on a brand-new machine, without a separate migration
 * step. (`npm run db:push` still works if you prefer using drizzle-kit.)
 */
function ensureSchema(sqlite: Database.Database) {
  sqlite.exec(`
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
  `);
}

// ============ USERS ============

export async function createUser(data: {
  email: string;
  passwordHash: string;
  name?: string | null;
  role?: "user" | "admin";
}) {
  const db = getDb();
  const result = db
    .insert(users)
    .values({
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name ?? null,
      role: data.role ?? "user",
    })
    .run();

  return getUserById(Number(result.lastInsertRowid));
}

export async function touchLastSignedIn(userId: number) {
  const db = getDb();
  db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId)).run();
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  const result = db.select().from(users).where(eq(users.email, email)).limit(1).all();
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = getDb();
  const result = db.select().from(users).where(eq(users.id, id)).limit(1).all();
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = getDb();
  return db.select().from(users).all();
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = getDb();
  db.update(users).set({ role }).where(eq(users.id, userId)).run();
  return getUserById(userId);
}

// ============ CATEGORIES ============

export async function getAllCategories() {
  const db = getDb();
  return db.select().from(categories).all();
}

export async function getCategoryBySlug(slug: string) {
  const db = getDb();
  const result = db.select().from(categories).where(eq(categories.slug, slug)).limit(1).all();
  return result.length > 0 ? result[0] : undefined;
}

export async function getCategoryById(id: number) {
  const db = getDb();
  const result = db.select().from(categories).where(eq(categories.id, id)).limit(1).all();
  return result.length > 0 ? result[0] : undefined;
}

export async function createCategory(data: { name: string; slug: string; description?: string }) {
  const db = getDb();
  const result = db.insert(categories).values(data).run();
  return getCategoryById(Number(result.lastInsertRowid));
}

// ============ PRODUCTS ============

export async function getAllProducts(filters?: {
  categoryId?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
}) {
  const db = getDb();

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
    .where(and(...conditions))
    .all();
}

export async function getProductById(id: number) {
  const db = getDb();
  const result = db.select().from(products).where(eq(products.id, id)).limit(1).all();
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
  const db = getDb();
  const result = db.insert(products).values(data).run();
  return getProductById(Number(result.lastInsertRowid));
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
  const db = getDb();
  db.update(products).set(data).where(eq(products.id, id)).run();
  return getProductById(id);
}

export async function deleteProduct(id: number) {
  const db = getDb();
  db.update(products).set({ isActive: false }).where(eq(products.id, id)).run();
  return true;
}

// ============ CART ============

export async function getCartItems(userId: number) {
  const db = getDb();
  return db.select().from(cartItems).where(eq(cartItems.userId, userId)).all();
}

export async function getCartItemById(cartItemId: number) {
  const db = getDb();
  const result = db.select().from(cartItems).where(eq(cartItems.id, cartItemId)).limit(1).all();
  return result.length > 0 ? result[0] : null;
}

export async function addToCart(userId: number, productId: number, quantity: number) {
  const db = getDb();

  const existing = db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .limit(1)
    .all();

  if (existing.length > 0) {
    db.update(cartItems)
      .set({ quantity: existing[0].quantity + quantity })
      .where(eq(cartItems.id, existing[0].id))
      .run();
  } else {
    db.insert(cartItems).values({ userId, productId, quantity }).run();
  }

  return getCartItems(userId);
}

export async function updateCartItemQuantity(cartItemId: number, quantity: number) {
  const db = getDb();

  if (quantity <= 0) {
    db.delete(cartItems).where(eq(cartItems.id, cartItemId)).run();
  } else {
    db.update(cartItems).set({ quantity }).where(eq(cartItems.id, cartItemId)).run();
  }

  return true;
}

export async function removeFromCart(cartItemId: number) {
  const db = getDb();
  db.delete(cartItems).where(eq(cartItems.id, cartItemId)).run();
  return true;
}

export async function clearCart(userId: number) {
  const db = getDb();
  db.delete(cartItems).where(eq(cartItems.userId, userId)).run();
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
  const db = getDb();
  const result = db.insert(orders).values(data).run();
  return getOrderById(Number(result.lastInsertRowid));
}

export async function getOrderById(id: number) {
  const db = getDb();
  const result = db.select().from(orders).where(eq(orders.id, id)).limit(1).all();
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserOrders(userId: number) {
  const db = getDb();
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).all();
}

export async function getAllOrders() {
  const db = getDb();
  return db.select().from(orders).orderBy(desc(orders.createdAt)).all();
}

export async function updateOrderStatus(
  id: number,
  status: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled"
) {
  const db = getDb();
  db.update(orders).set({ status }).where(eq(orders.id, id)).run();
  return getOrderById(id);
}

// ============ PAYMENT SETTINGS ============

export async function getPaymentSettings() {
  const db = getDb();
  const result = db.select().from(paymentSettings).limit(1).all();
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
  const db = getDb();
  const existing = await getPaymentSettings();

  if (existing) {
    db.update(paymentSettings).set(data).where(eq(paymentSettings.id, existing.id)).run();
    return getPaymentSettings();
  }

  const result = db.insert(paymentSettings).values(data).run();
  const created = db
    .select()
    .from(paymentSettings)
    .where(eq(paymentSettings.id, Number(result.lastInsertRowid)))
    .limit(1)
    .all();
  return created.length > 0 ? created[0] : null;
}
