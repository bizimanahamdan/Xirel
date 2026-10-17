import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let tempDirectory: string;
let database: typeof import("./db");

beforeAll(async () => {
  tempDirectory = mkdtempSync(path.join(os.tmpdir(), "xirel-security-db-"));
  vi.stubEnv("DATABASE_FILE", path.join(tempDirectory, "security.sqlite"));
  vi.resetModules();
  database = await import("./db");
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(tempDirectory, { recursive: true, force: true });
});

describe("additive database security operations", () => {
  it("creates at most one first administrator when bootstrap races", async () => {
    const first = await database.createUser({
      email: "first-operator@example.com",
      passwordHash: "existing-hash-one",
      name: "First Operator",
    });
    const second = await database.createUser({
      email: "second-operator@example.com",
      passwordHash: "existing-hash-two",
      name: "Second Operator",
    });

    const results = await Promise.allSettled([
      database.bootstrapAdminForEmail(first.email),
      database.bootstrapAdminForEmail(second.email),
    ]);
    expect(results.some(result => result.status === "fulfilled")).toBe(true);

    const administrators = (await database.getAllUsers()).filter(
      user => user.role === "admin"
    );
    expect(administrators).toHaveLength(1);
    expect([first.id, second.id]).toContain(administrators[0]?.id);
  });

  it("preserves existing administrators and does not promote another configured email", async () => {
    const currentAdmin = (await database.getAllUsers()).find(
      user => user.role === "admin"
    );
    const other = await database.createUser({
      email: "later-operator@example.com",
      passwordHash: "existing-hash-three",
      name: "Later Operator",
    });

    await database.bootstrapAdminForEmail(other.email);
    const users = await database.getAllUsers();
    expect(users.find(user => user.id === currentAdmin?.id)?.role).toBe(
      "admin"
    );
    expect(users.find(user => user.id === other.id)?.role).toBe("user");
  });

  it("marks only pending orders paid after a verified provider response", async () => {
    const makeOrder = (orderNumber: string) =>
      database.createOrder({
        userId: 99,
        orderNumber,
        totalAmount: "10.00",
        shippingAddress: {
          firstName: "Test",
          lastName: "Customer",
          email: "test@example.com",
          phone: "+250700000000",
          street: "1 Test Street",
          city: "Kigali",
          state: "Kigali",
          zipCode: "00000",
          country: "RW",
        },
        paymentMethod: "momo",
        items: [
          { productId: 1, name: "Test item", price: "10.00", quantity: 1 },
        ],
      });

    const pending = await makeOrder(`PENDING-${Date.now()}`);
    expect(await database.markOrderPaidIfPending(pending.id)).toMatchObject({
      id: pending.id,
      status: "paid",
    });

    const cancelled = await makeOrder(`CANCELLED-${Date.now()}`);
    await database.updateOrderStatus(cancelled.id, "cancelled");
    expect(await database.markOrderPaidIfPending(cancelled.id)).toBeUndefined();
    expect((await database.getOrderById(cancelled.id))?.status).toBe(
      "cancelled"
    );
  });

  it("keeps reviewer emails and stable user IDs out of public review results", async () => {
    const suffix = Date.now();
    const reviewer = await database.createUser({
      email: `reviewer-${suffix}@example.com`,
      passwordHash: "test-hash",
      name: "Taylor Example Person",
    });
    const category = await database.createCategory({
      name: `Review Category ${suffix}`,
      slug: `review-category-${suffix}`,
    });
    const product = await database.createProduct({
      name: "Review Test Product",
      price: "12.00",
      categoryId: category.id,
      stock: 5,
    });
    await database.upsertReview({
      productId: product.id,
      userId: reviewer.id,
      rating: 5,
      comment: "Looks good",
    });

    const [publicReview] = await database.getProductReviews(product.id);
    expect(publicReview).toMatchObject({
      reviewerName: "Taylor",
      rating: 5,
      comment: "Looks good",
    });
    expect(publicReview).not.toHaveProperty("reviewerEmail");
    expect(publicReview).not.toHaveProperty("userId");
    expect(publicReview).not.toHaveProperty("passwordHash");
  });

  it("uses atomic expiring counters for shared rate-limit storage", async () => {
    const first = await database.incrementAuthRateLimit(
      "test-counter",
      1_000,
      10_000
    );
    const second = await database.incrementAuthRateLimit(
      "test-counter",
      1_000,
      10_500
    );
    const expired = await database.incrementAuthRateLimit(
      "test-counter",
      1_000,
      11_001
    );

    expect(first.attempts).toBe(1);
    expect(second.attempts).toBe(2);
    expect(expired).toMatchObject({ attempts: 1, windowStartedAt: 11_001 });

    await database.clearAuthRateLimits(["test-counter"]);
    const cleared = await database.incrementAuthRateLimit(
      "test-counter",
      1_000,
      11_002
    );
    expect(cleared.attempts).toBe(1);
  });
});
