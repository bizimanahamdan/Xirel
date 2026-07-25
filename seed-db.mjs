// Seeds the database with sample categories and products.
// Works against either a local SQLite file (default) or a hosted Turso
// database (if TURSO_DATABASE_URL is set) — same code path either way.
//
// Run with: npm run seed

import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const tursoUrl = process.env.TURSO_DATABASE_URL ?? "";
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN ?? "";
const databaseFile =
  process.env.DATABASE_FILE ?? path.resolve(process.cwd(), "data", "store.db");

if (!tursoUrl) {
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
}

const client = tursoUrl
  ? createClient({ url: tursoUrl, authToken: tursoAuthToken || undefined })
  : createClient({ url: `file:${databaseFile}` });

await client.executeMultiple(`
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

const categoryCountResult = await client.execute("SELECT COUNT(*) AS count FROM categories");
const categoryCount = Number(categoryCountResult.rows[0].count);

if (categoryCount > 0) {
  console.log("Database already has categories — skipping seed (nothing to do).");
  process.exit(0);
}

console.log("Seeding database...");

const electronicsResult = await client.execute({
  sql: "INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)",
  args: ["Electronics", "electronics", "Premium electronic devices and gadgets"],
});
const electronicsId = Number(electronicsResult.lastInsertRowid);

const outfitsResult = await client.execute({
  sql: "INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)",
  args: ["Outfits", "outfits", "Stylish clothing and fashion items"],
});
const outfitsId = Number(outfitsResult.lastInsertRowid);

console.log("✓ Categories created");

const insertProduct = async (name, description, price, categoryId, stock, sku) => {
  await client.execute({
    sql: `INSERT INTO products (name, description, price, categoryId, stock, sku, isActive)
          VALUES (?, ?, ?, ?, ?, ?, 1)`,
    args: [name, description, price, categoryId, stock, sku],
  });
};

const electronicsProducts = [
  ["Premium Wireless Headphones", "High-quality noise-cancelling wireless headphones with 30-hour battery life", "199.99", 50, "ELEC-001"],
  ["Smart Watch Pro", "Advanced fitness tracking smartwatch with heart rate monitor and GPS", "299.99", 35, "ELEC-002"],
  ["Portable Phone Charger", "20000mAh portable power bank with fast charging support", "49.99", 100, "ELEC-003"],
  ["4K Webcam", "Professional 4K webcam with auto-focus and built-in microphone", "129.99", 25, "ELEC-004"],
  ["Wireless Charging Pad", "Fast wireless charging pad compatible with all Qi-enabled devices", "39.99", 60, "ELEC-005"],
];

for (const [name, description, price, stock, sku] of electronicsProducts) {
  await insertProduct(name, description, price, electronicsId, stock, sku);
}

console.log("✓ Electronics products created");

const outfitsProducts = [
  ["Premium Cotton T-Shirt", "Comfortable 100% organic cotton t-shirt in various colors", "34.99", 80, "OUTF-001"],
  ["Classic Denim Jeans", "Timeless denim jeans with perfect fit and durability", "79.99", 45, "OUTF-002"],
  ["Elegant Blazer", "Professional blazer perfect for business and casual wear", "149.99", 30, "OUTF-003"],
  ["Comfortable Sneakers", "Stylish and comfortable sneakers for everyday wear", "89.99", 55, "OUTF-004"],
  ["Summer Dress", "Light and breathable summer dress perfect for warm weather", "59.99", 40, "OUTF-005"],
];

for (const [name, description, price, stock, sku] of outfitsProducts) {
  await insertProduct(name, description, price, outfitsId, stock, sku);
}

console.log("✓ Outfits products created");

await client.execute("INSERT INTO paymentSettings (stripeEnabled, paypalEnabled) VALUES (0, 0)");

console.log("✓ Payment settings initialized");
console.log("\n✅ Database seeded successfully!");
