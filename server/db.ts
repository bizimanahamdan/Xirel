import { eq, and, like, gte, lte, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import {
  users,
  categories,
  products,
  cartItems,
  orders,
  paymentSettings,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN!,
  });

  _db = drizzle(client);
  return _db;
}

// ============ USERS ============

export async function createUser(data: {
  email: string;
  passwordHash: string;
  name?: string | null;
  role?: "user" | "admin";
}) {
  const db = getDb();
  const result = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name ?? null,
      role: data.role ?? "user",
    })
    .returning({ id: users.id });

  return getUserById(result[0].id);
}

export async function touchLastSignedIn(userId: number) {
  const db = getDb();
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = getDb();
  return await db.select().from(users);
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = getDb();
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return getUserById(userId);
}

// ============ CATEGORIES ============

export async function getAllCategories() {
  const db = getDb();
  return await db.select().from(categories);
}

export async function getCategoryBySlug(slug: string) {
  const db = getDb();
  const result = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCategoryById(id: number) {
  const db = getDb();
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCategory(data: { name: string; slug: string; description?: string }) {
  const db = getDb();
  const result = await db.insert(categories).values(data).returning({ id: categories.id });
  return getCategoryById(result[0].id);
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

  return await db
    .select()
    .from(products)
    .where(and(...conditions));
}

export async function getProductById(id: number) {
  const db = getDb();
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
  const db = getDb();
  const result = await db.insert(products).values(data).returning({ id: products.id });
  return getProductById(result[0].id);
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
  await db.update(products).set(data).where(eq(products.id, id));
  return getProductById(id);
}

export async function deleteProduct(id: number) {
  const db = getDb();
  await db.update(products).set({ isActive: false }).where(eq(products.id, id));
  return true;
}

// ============ CART ============

export async function getCartItems(userId: number) {
  const db = getDb();
  return await db.select().from(cartItems).where(eq(cartItems.userId, userId));
}

export async function getCartItemById(cartItemId: number) {
  const db = getDb();
  const result = await db.select().from(cartItems).where(eq(cartItems.id, cartItemId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function addToCart(userId: number, productId: number, quantity: number) {
  const db = getDb();

  const existing = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(cartItems)
      .set({ quantity: existing[0].quantity + quantity })
      .where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({ userId, productId, quantity });
  }

  return getCartItems(userId);
}

export async function updateCartItemQuantity(cartItemId: number, quantity: number) {
  const db = getDb();

  if (quantity <= 0) {
    await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
  } else {
    await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, cartItemId));
  }

  return true;
}

export async function removeFromCart(cartItemId: number) {
  const db = getDb();
  await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
  return true;
}

export async function clearCart(userId: number) {
  const db = getDb();
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
  const db = getDb();
  const result = await db.insert(orders).values(data).returning({ id: orders.id });
  return getOrderById(result[0].id);
}

export async function getOrderById(id: number) {
  const db = getDb();
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserOrders(userId: number) {
  const db = getDb();
  return await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function getAllOrders() {
  const db = getDb();
  return await db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function updateOrderStatus(
  id: number,
  status: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled"
) {
  const db = getDb();
  await db.update(orders).set({ status }).where(eq(orders.id, id));
  return getOrderById(id);
}

// ============ PAYMENT SETTINGS ============

export async function getPaymentSettings() {
  const db = getDb();
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
  const db = getDb();
  const existing = await getPaymentSettings();

  if (existing) {
    await db.update(paymentSettings).set(data).where(eq(paymentSettings.id, existing.id));
    return getPaymentSettings();
  }

  const result = await db.insert(paymentSettings).values(data).returning({ id: paymentSettings.id });
  const created = await db
    .select()
    .from(paymentSettings)
    .where(eq(paymentSettings.id, result[0].id))
    .limit(1);
  return created.length > 0 ? created[0] : null;
    }
                                 
