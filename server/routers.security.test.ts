import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { hashPassword } from "./_core/auth";
import { ENV } from "./_core/env";
import * as db from "./db";

const mocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  bootstrapAdminForEmail: vi.fn(),
  getUserById: vi.fn(),
  touchLastSignedIn: vi.fn(),
  getAllUsers: vi.fn(),
  updateUserRole: vi.fn(),
  incrementAuthRateLimit: vi.fn(),
  clearAuthRateLimits: vi.fn(),
  getPaymentSettings: vi.fn(),
  updatePaymentSettings: vi.fn(),
  getOrderById: vi.fn(),
  setOrderStripePaymentIntentId: vi.fn(),
  createStripePaymentIntent: vi.fn(),
  getCartItems: vi.fn(),
  getProductById: vi.fn(),
  createOrder: vi.fn(),
  clearCart: vi.fn(),
}));

vi.mock("./db", () => mocks);
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    paymentIntents: { create: mocks.createStripePaymentIntent },
  })),
}));

const rateLimitCounters = new Map<
  string,
  { windowStartedAt: number; attempts: number }
>();

function makeUser(
  overrides: Partial<NonNullable<TrpcContext["user"]>> = {}
): NonNullable<TrpcContext["user"]> {
  return {
    id: 3,
    email: "customer@example.com",
    passwordHash: "$2a$10$not-a-real-hash-for-response-tests-only",
    name: "Example Customer",
    role: "user",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-02T00:00:00.000Z"),
    lastSignedIn: new Date("2025-01-03T00:00:00.000Z"),
    ...overrides,
  };
}

function makeContext(user: TrpcContext["user"] = null, ip = "203.0.113.10") {
  const cookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];
  const clearedCookies: Array<{
    name: string;
    options: Record<string, unknown>;
  }> = [];
  const responseHeaders: Record<string, string> = {};
  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      ip,
      headers: {},
      socket: { remoteAddress: ip },
    } as unknown as TrpcContext["req"],
    res: {
      cookie: (
        name: string,
        value: string,
        options: Record<string, unknown>
      ) => {
        cookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
      setHeader: (name: string, value: string) => {
        responseHeaders[name] = value;
      },
    } as unknown as TrpcContext["res"],
  };
  return { ctx, cookies, clearedCookies, responseHeaders };
}

function resetRateLimitStore() {
  rateLimitCounters.clear();
  mocks.incrementAuthRateLimit.mockImplementation(
    async (key: string, windowMs: number, now: number) => {
      const current = rateLimitCounters.get(key);
      const next =
        !current || now - current.windowStartedAt >= windowMs
          ? { windowStartedAt: now, attempts: 1 }
          : { ...current, attempts: current.attempts + 1 };
      rateLimitCounters.set(key, next);
      return next;
    }
  );
  mocks.clearAuthRateLimits.mockImplementation(async (keys: string[]) => {
    for (const key of keys) rateLimitCounters.delete(key);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitStore();
  mocks.getUserByEmail.mockResolvedValue(undefined);
  mocks.createUser.mockImplementation(
    async (data: {
      email: string;
      passwordHash: string;
      name?: string | null;
    }) =>
      makeUser({
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name ?? null,
      })
  );
  mocks.bootstrapAdminForEmail.mockResolvedValue(undefined);
  mocks.getUserById.mockImplementation(async (id: number) => makeUser({ id }));
  mocks.touchLastSignedIn.mockResolvedValue(undefined);
  mocks.getAllUsers.mockResolvedValue([makeUser({ role: "admin" })]);
  mocks.updateUserRole.mockImplementation(
    async (id: number, role: "user" | "admin") => makeUser({ id, role })
  );
  mocks.getPaymentSettings.mockResolvedValue({
    id: 2,
    stripePublishableKey: "pk_test_public",
    stripeSecretKey: "sk_test_do_not_return",
    stripeEnabled: true,
    paypalEnabled: false,
    updatedAt: new Date(),
  });
  mocks.getOrderById.mockResolvedValue(undefined);
  mocks.setOrderStripePaymentIntentId.mockResolvedValue(undefined);
  mocks.createStripePaymentIntent.mockResolvedValue({
    id: "pi_test_123",
    client_secret: "pi_test_client_secret",
  });
  mocks.getCartItems.mockResolvedValue([]);
  mocks.getProductById.mockResolvedValue(undefined);
  mocks.createOrder.mockImplementation(
    async (data: Record<string, unknown>) => ({
      id: 88,
      status: "pending",
      ...data,
    })
  );
  mocks.clearCart.mockResolvedValue(undefined);
  mocks.updatePaymentSettings.mockImplementation(
    async (input: Record<string, unknown>) => ({
      id: 2,
      stripePublishableKey: "pk_test_public",
      stripeSecretKey: input.stripeSecretKey ?? "sk_test_do_not_return",
      stripeEnabled: true,
      paypalEnabled: false,
      updatedAt: new Date(),
    })
  );
});

describe("API user serialization and authentication", () => {
  it("never returns passwordHash from registration, even when a role is submitted", async () => {
    const email = `public-${Date.now()}@example.com`;
    const { ctx, cookies } = makeContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.register({
      email,
      password: "a-valid-registration-password",
      name: "New Customer",
      role: "admin",
    } as never);

    expect(result).toMatchObject({ email, name: "New Customer", role: "user" });
    expect(result).not.toHaveProperty("passwordHash");
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: email.toLowerCase(),
        name: "New Customer",
      })
    );
    expect(mocks.createUser.mock.calls[0]?.[0]).not.toHaveProperty("role");
    expect(mocks.bootstrapAdminForEmail).not.toHaveBeenCalled();
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.options.maxAge).toBe(ENV.sessionTtlMs);
  });

  it("promotes only the explicitly configured administrator email", async () => {
    const previousAdminEmail = ENV.adminEmail;
    ENV.adminEmail = "operator@example.com";
    mocks.getUserById.mockResolvedValue(makeUser({ role: "admin" }));
    const { ctx } = makeContext();

    try {
      const result = await appRouter.createCaller(ctx).auth.register({
        email: " OPERATOR@example.com ",
        password: "a-valid-registration-password",
      });
      expect(result.role).toBe("admin");
      expect(mocks.bootstrapAdminForEmail).toHaveBeenCalledWith(
        "operator@example.com"
      );
    } finally {
      ENV.adminEmail = previousAdminEmail;
    }
  });

  it("returns a password-free current-user response", async () => {
    const { ctx } = makeContext(makeUser());
    const result = await appRouter.createCaller(ctx).auth.me();
    expect(result).toMatchObject({
      id: 3,
      email: "customer@example.com",
      role: "user",
    });
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("returns a password-free login response while checking the stored hash", async () => {
    const passwordHash = await hashPassword("correct-password");
    const user = makeUser({ passwordHash });
    mocks.getUserByEmail.mockResolvedValue(user);
    mocks.getUserById.mockResolvedValue({ ...user, lastSignedIn: new Date() });
    const { ctx, cookies } = makeContext();

    const result = await appRouter.createCaller(ctx).auth.login({
      email: " CUSTOMER@example.com ",
      password: "correct-password",
    });

    expect(result).toMatchObject({
      email: "customer@example.com",
      role: "user",
    });
    expect(result).not.toHaveProperty("passwordHash");
    expect(mocks.getUserByEmail).toHaveBeenCalledWith("customer@example.com");
    expect(mocks.touchLastSignedIn).toHaveBeenCalledWith(user.id);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("uses the same generic login failure for unknown emails and incorrect passwords", async () => {
    const { ctx: unknownContext } = makeContext(null, "203.0.113.20");
    mocks.getUserByEmail.mockResolvedValue(undefined);
    const unknownError = await appRouter
      .createCaller(unknownContext)
      .auth.login({ email: "missing@example.com", password: "wrong-password" })
      .catch(error => error);

    const passwordHash = await hashPassword("actual-password");
    mocks.getUserByEmail.mockResolvedValue(makeUser({ passwordHash }));
    const { ctx: existingContext } = makeContext(null, "203.0.113.21");
    const wrongPasswordError = await appRouter
      .createCaller(existingContext)
      .auth.login({ email: "customer@example.com", password: "wrong-password" })
      .catch(error => error);

    expect(unknownError).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid email or password",
    });
    expect(wrongPasswordError).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid email or password",
    });
  });

  it("returns a throttling response after repeated failed logins and allows login after expiry", async () => {
    const passwordHash = await hashPassword("correct-password");
    const user = makeUser({ passwordHash });
    mocks.getUserByEmail.mockResolvedValue(undefined);
    const { ctx, responseHeaders } = makeContext(null, "203.0.113.30");
    const caller = appRouter.createCaller(ctx);
    const originalNow = Date.now();
    let currentNow = originalNow;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => currentNow);

    try {
      for (let i = 0; i < 8; i++) {
        await expect(
          caller.auth.login({
            email: "rate-limit@example.com",
            password: "incorrect-password",
          })
        ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      }
      await expect(
        caller.auth.login({
          email: "rate-limit@example.com",
          password: "incorrect-password",
        })
      ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
      expect(responseHeaders["Retry-After"]).toBeDefined();

      currentNow += 15 * 60 * 1000 + 1;
      mocks.getUserByEmail.mockResolvedValue(user);
      mocks.getUserById.mockResolvedValue(user);
      await expect(
        caller.auth.login({
          email: "rate-limit@example.com",
          password: "correct-password",
        })
      ).resolves.toMatchObject({ role: "user" });
    } finally {
      nowSpy.mockRestore();
    }
  });
});

describe("admin API response and authorization", () => {
  it("serializes admin user lists without password hashes", async () => {
    const { ctx } = makeContext(makeUser({ role: "admin" }));
    const result = await appRouter.createCaller(ctx).users.list();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      email: "customer@example.com",
      role: "admin",
    });
    expect(result[0]).not.toHaveProperty("passwordHash");
  });

  it("does not return stored Stripe credentials from payment-settings APIs", async () => {
    const caller = appRouter.createCaller(
      makeContext(makeUser({ role: "admin" })).ctx
    );
    const settings = await caller.paymentSettings.get();
    expect(settings).toMatchObject({
      stripeSecretConfigured: true,
      stripeEnabled: true,
    });
    expect(settings).not.toHaveProperty("stripeSecretKey");

    const updated = await caller.paymentSettings.update({
      stripeSecretKey: "sk_test_new_secret",
    });
    expect(updated).toMatchObject({ stripeSecretConfigured: true });
    expect(updated).not.toHaveProperty("stripeSecretKey");
  });

  it("returns only safe supplier and payment connection status", async () => {
    const admin = appRouter.createCaller(
      makeContext(makeUser({ role: "admin" })).ctx
    );
    const [printifyStatus, cjStatus, higgsfieldStatus, momoStatus] =
      await Promise.all([
        admin.integrations.printify.status(),
        admin.integrations.cj.status(),
        admin.integrations.higgsfield.status(),
        appRouter.createCaller(makeContext()).payments.momo.status(),
      ]);

    for (const status of [
      printifyStatus,
      cjStatus,
      higgsfieldStatus,
      momoStatus,
    ]) {
      expect(status).not.toHaveProperty("apiKey");
      expect(status).not.toHaveProperty("accessToken");
      expect(status).not.toHaveProperty("refreshToken");
      expect(status).not.toHaveProperty("secret");
    }
  });

  it("returns UNAUTHORIZED without a session and FORBIDDEN for ordinary users on admin routes", async () => {
    const anonymous = appRouter.createCaller(makeContext(null).ctx);
    const ordinaryUser = appRouter.createCaller(
      makeContext(makeUser({ role: "user" })).ctx
    );

    await expect(anonymous.users.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      ordinaryUser.users.updateRole({ id: 3, role: "admin" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(ordinaryUser.orders.deleteAll()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(ordinaryUser.paymentSettings.get()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocks.updateUserRole).not.toHaveBeenCalled();
  });
});

describe("order ownership and server-calculated payment totals", () => {
  it("creates a Stripe intent from the owned order total, not a client amount", async () => {
    const currentUser = makeUser();
    mocks.getOrderById.mockResolvedValue({
      id: 44,
      userId: currentUser.id,
      status: "pending",
      totalAmount: "25.00",
    });
    const caller = appRouter.createCaller(makeContext(currentUser).ctx);

    const result = await caller.orders.createPaymentIntent({
      orderId: 44,
      amount: 0.01,
    } as never);

    expect(mocks.createStripePaymentIntent).toHaveBeenCalledWith({
      amount: 2500,
      currency: "usd",
      metadata: { userId: String(currentUser.id), orderId: "44" },
    });
    expect(mocks.setOrderStripePaymentIntentId).toHaveBeenCalledWith(
      44,
      "pi_test_123"
    );
    expect(result).toEqual({
      clientSecret: "pi_test_client_secret",
      paymentIntentId: "pi_test_123",
    });
  });

  it("does not create a Stripe intent for another user's order", async () => {
    mocks.getOrderById.mockResolvedValue({
      id: 45,
      userId: 999,
      status: "pending",
      totalAmount: "25.00",
    });
    const caller = appRouter.createCaller(makeContext(makeUser()).ctx);

    await expect(
      caller.orders.createPaymentIntent({ orderId: 45 })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.createStripePaymentIntent).not.toHaveBeenCalled();
  });

  it("does not let guest checkout create a session for an existing account", async () => {
    mocks.getUserByEmail.mockResolvedValue(
      makeUser({ email: "victim@example.com" })
    );
    const { ctx, cookies } = makeContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.orders.create({
        shippingAddress: {
          firstName: "Victim",
          lastName: "Customer",
          email: "victim@example.com",
          phone: "+250788000000",
          street: "1 Main Road",
          city: "Kigali",
          state: "Kigali",
          zipCode: "00000",
          country: "Rwanda",
        },
        items: [{ productId: 1, quantity: 1 }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(cookies).toHaveLength(0);
  });

  it("preserves guest checkout for new emails using a server-priced pending order", async () => {
    mocks.getProductById.mockResolvedValue({
      id: 9,
      name: "Product",
      price: "12.50",
      stock: 10,
      isActive: true,
    });
    const { ctx, cookies } = makeContext();
    const result = await appRouter.createCaller(ctx).orders.create({
      shippingAddress: {
        firstName: "Guest",
        lastName: "Customer",
        email: "Guest@Example.com",
        phone: "+250788000000",
        street: "1 Main Road",
        city: "Kigali",
        state: "Kigali",
        zipCode: "00000",
        country: "Rwanda",
      },
      paymentMethod: "manual",
      items: [{ productId: 9, quantity: 2 }],
    });

    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "guest@example.com" })
    );
    const orderInput = mocks.createOrder.mock.calls[0]?.[0];
    expect(orderInput).toMatchObject({
      totalAmount: "25.00",
      items: [{ productId: 9, name: "Product", price: "12.50", quantity: 2 }],
    });
    expect(orderInput).not.toHaveProperty("status");
    expect(result).toMatchObject({ status: "pending", userId: 3 });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.options.maxAge).toBe(ENV.sessionTtlMs);
  });

  it("uses server product prices and always starts client-created orders as pending", async () => {
    const currentUser = makeUser();
    mocks.getCartItems.mockResolvedValue([
      { id: 1, userId: currentUser.id, productId: 9, quantity: 2 },
    ]);
    mocks.getProductById.mockResolvedValue({
      id: 9,
      name: "Product",
      price: "12.50",
      stock: 10,
      isActive: true,
    });
    mocks.createOrder.mockImplementation(
      async (data: Record<string, unknown>) => ({
        id: 44,
        orderNumber: "ORD-TEST",
        status: "pending",
        ...data,
      })
    );
    const caller = appRouter.createCaller(makeContext(currentUser).ctx);

    await caller.orders.create({
      shippingAddress: {
        firstName: "Example",
        lastName: "Customer",
        email: "customer@example.com",
        phone: "+250788000000",
        street: "1 Main Road",
        city: "Kigali",
        state: "Kigali",
        zipCode: "00000",
        country: "Rwanda",
      },
      paymentMethod: "manual",
      items: [{ productId: 9000, quantity: 100 }],
      totalAmount: "0.01",
      status: "paid",
      stripePaymentIntentId: "pi_unverified",
    } as never);

    const orderInput = mocks.createOrder.mock.calls[0]?.[0];
    expect(orderInput).toMatchObject({
      userId: currentUser.id,
      totalAmount: "25.00",
      paymentMethod: "manual",
    });
    expect(orderInput).not.toHaveProperty("status");
    expect(orderInput).not.toHaveProperty("stripePaymentIntentId");
  });
});
