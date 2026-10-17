import { describe, expect, it } from "vitest";
import {
  createAuthenticationRateLimiter,
  LOGIN_RATE_LIMITS,
  REGISTRATION_RATE_LIMIT,
  SUPPORT_CHAT_RATE_LIMIT,
  type RateLimitCounter,
  type RateLimitStore,
} from "./rateLimit";

class MemoryRateLimitStore implements RateLimitStore {
  readonly values = new Map<string, RateLimitCounter>();

  async increment(
    key: string,
    windowMs: number,
    now: number
  ): Promise<RateLimitCounter> {
    const current = this.values.get(key);
    const next =
      !current || now - current.windowStartedAt >= windowMs
        ? { windowStartedAt: now, attempts: 1 }
        : { ...current, attempts: current.attempts + 1 };
    this.values.set(key, next);
    return next;
  }

  async clear(keys: string[]): Promise<void> {
    for (const key of keys) this.values.delete(key);
  }
}

describe("authentication rate limiting", () => {
  it("throttles repeated attempts using normalized account and source keys", async () => {
    const store = new MemoryRateLimitStore();
    let now = 10_000;
    const limiter = createAuthenticationRateLimiter(
      store,
      "test-shared-secret",
      () => now
    );

    for (let i = 0; i < LOGIN_RATE_LIMITS.pair.attempts; i++) {
      expect(
        await limiter.consumeLoginAttempt(
          "198.51.100.4",
          " Person@Example.com "
        )
      ).toMatchObject({
        limited: false,
      });
    }
    const blocked = await limiter.consumeLoginAttempt(
      "198.51.100.4",
      "person@example.com"
    );
    expect(blocked.limited).toBe(true);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(
      [...store.values.keys()].every(key => !key.includes("person@example.com"))
    ).toBe(true);

    now += LOGIN_RATE_LIMITS.pair.windowMs + 1;
    expect(
      await limiter.consumeLoginAttempt("198.51.100.4", "person@example.com")
    ).toMatchObject({
      limited: false,
    });
  });

  it("clears account and IP/account-pair counters after a successful login", async () => {
    const store = new MemoryRateLimitStore();
    const limiter = createAuthenticationRateLimiter(
      store,
      "test-shared-secret",
      () => 20_000
    );
    await limiter.consumeLoginAttempt("198.51.100.5", "customer@example.com");
    await limiter.clearSuccessfulLogin("198.51.100.5", "CUSTOMER@example.com");

    expect(
      await limiter.consumeLoginAttempt("198.51.100.5", "customer@example.com")
    ).toMatchObject({
      limited: false,
    });
    // IP-wide protection remains in place after one account authenticates.
    expect(store.values.size).toBe(3);
  });

  it("temporarily throttles registrations without creating a permanent lockout", async () => {
    const store = new MemoryRateLimitStore();
    let now = 30_000;
    const limiter = createAuthenticationRateLimiter(
      store,
      "test-shared-secret",
      () => now
    );

    for (let i = 0; i < REGISTRATION_RATE_LIMIT.attempts; i++) {
      expect(
        await limiter.consumeRegistrationAttempt("203.0.113.5")
      ).toMatchObject({ limited: false });
    }
    expect(
      await limiter.consumeRegistrationAttempt("203.0.113.5")
    ).toMatchObject({ limited: true });

    now += REGISTRATION_RATE_LIMIT.windowMs + 1;
    expect(
      await limiter.consumeRegistrationAttempt("203.0.113.5")
    ).toMatchObject({ limited: false });
  });

  it("limits public support-chat calls per source without storing raw IP addresses", async () => {
    const store = new MemoryRateLimitStore();
    let now = 40_000;
    const limiter = createAuthenticationRateLimiter(
      store,
      "test-shared-secret",
      () => now
    );

    for (let i = 0; i < SUPPORT_CHAT_RATE_LIMIT.attempts; i++) {
      expect(
        await limiter.consumeSupportChatAttempt("203.0.113.6")
      ).toMatchObject({ limited: false });
    }
    expect(
      await limiter.consumeSupportChatAttempt("203.0.113.6")
    ).toMatchObject({ limited: true });
    expect(
      [...store.values.keys()].every(key => !key.includes("203.0.113.6"))
    ).toBe(true);

    now += SUPPORT_CHAT_RATE_LIMIT.windowMs + 1;
    expect(
      await limiter.consumeSupportChatAttempt("203.0.113.6")
    ).toMatchObject({ limited: false });
  });
});
