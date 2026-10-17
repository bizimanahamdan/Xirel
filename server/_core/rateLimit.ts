import { createHmac } from "node:crypto";
import * as db from "../db";
import { ENV } from "./env";

export const LOGIN_RATE_LIMITS = {
  pair: { attempts: 8, windowMs: 15 * 60 * 1000 },
  account: { attempts: 20, windowMs: 15 * 60 * 1000 },
  ip: { attempts: 100, windowMs: 15 * 60 * 1000 },
} as const;

export const REGISTRATION_RATE_LIMIT = {
  attempts: 20,
  windowMs: 60 * 60 * 1000,
} as const;

export const SUPPORT_CHAT_RATE_LIMIT = {
  attempts: 30,
  windowMs: 15 * 60 * 1000,
} as const;

export type RateLimitCounter = { windowStartedAt: number; attempts: number };

export type RateLimitStore = {
  increment(
    key: string,
    windowMs: number,
    now: number
  ): Promise<RateLimitCounter>;
  clear(keys: string[]): Promise<void>;
};

export type RateLimitDecision = {
  limited: boolean;
  retryAfterSeconds: number;
};

function digestKey(secret: string, namespace: string, value: string): string {
  return `${namespace}:${createHmac("sha256", secret).update(value).digest("hex")}`;
}

function normalizedIp(ip: string): string {
  const trimmed = ip.trim();
  return trimmed ? trimmed.slice(0, 128) : "unknown";
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function decide(
  counters: Array<{
    counter: RateLimitCounter;
    maxAttempts: number;
    windowMs: number;
  }>,
  now: number
): RateLimitDecision {
  const exceeded = counters.filter(
    ({ counter, maxAttempts }) => counter.attempts > maxAttempts
  );
  if (exceeded.length === 0) return { limited: false, retryAfterSeconds: 0 };

  const blockedUntil = Math.max(
    ...exceeded.map(
      ({ counter, windowMs }) => counter.windowStartedAt + windowMs
    )
  );
  return {
    limited: true,
    retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
  };
}

/**
 * Policies are separate from storage so the same logic can be tested with a
 * deterministic store. The production store is the shared SQLite/libSQL DB,
 * not process memory; keys are HMACs so raw email addresses and IPs are not
 * persisted in the rate-limit table.
 */
export function createAuthenticationRateLimiter(
  store: RateLimitStore,
  secret: string,
  now: () => number = () => Date.now()
) {
  function loginKeys(ip: string, email: string) {
    const safeIp = normalizedIp(ip);
    const safeEmail = normalizedEmail(email);
    return {
      pair: digestKey(secret, "login-pair", `${safeIp}\u0000${safeEmail}`),
      account: digestKey(secret, "login-account", safeEmail),
      ip: digestKey(secret, "login-ip", safeIp),
    };
  }

  return {
    async consumeLoginAttempt(
      ip: string,
      email: string
    ): Promise<RateLimitDecision> {
      const currentTime = now();
      const keys = loginKeys(ip, email);
      const definitions = [
        { key: keys.pair, ...LOGIN_RATE_LIMITS.pair },
        { key: keys.account, ...LOGIN_RATE_LIMITS.account },
        { key: keys.ip, ...LOGIN_RATE_LIMITS.ip },
      ];
      const counters = await Promise.all(
        definitions.map(async definition => ({
          counter: await store.increment(
            definition.key,
            definition.windowMs,
            currentTime
          ),
          maxAttempts: definition.attempts,
          windowMs: definition.windowMs,
        }))
      );
      return decide(counters, currentTime);
    },

    async clearSuccessfulLogin(ip: string, email: string): Promise<void> {
      const keys = loginKeys(ip, email);
      // Do not clear the IP bucket: successful credentials from another
      // account must not reset a source-wide brute-force counter.
      await store.clear([keys.pair, keys.account]);
    },

    async consumeRegistrationAttempt(ip: string): Promise<RateLimitDecision> {
      const currentTime = now();
      const key = digestKey(secret, "registration-ip", normalizedIp(ip));
      const counter = await store.increment(
        key,
        REGISTRATION_RATE_LIMIT.windowMs,
        currentTime
      );
      return decide(
        [
          {
            counter,
            maxAttempts: REGISTRATION_RATE_LIMIT.attempts,
            windowMs: REGISTRATION_RATE_LIMIT.windowMs,
          },
        ],
        currentTime
      );
    },

    async consumeSupportChatAttempt(ip: string): Promise<RateLimitDecision> {
      const currentTime = now();
      const key = digestKey(secret, "support-chat-ip", normalizedIp(ip));
      const counter = await store.increment(
        key,
        SUPPORT_CHAT_RATE_LIMIT.windowMs,
        currentTime
      );
      return decide(
        [
          {
            counter,
            maxAttempts: SUPPORT_CHAT_RATE_LIMIT.attempts,
            windowMs: SUPPORT_CHAT_RATE_LIMIT.windowMs,
          },
        ],
        currentTime
      );
    },
  };
}

const sharedDatabaseStore: RateLimitStore = {
  increment: (key, windowMs, now) =>
    db.incrementAuthRateLimit(key, windowMs, now),
  clear: keys => db.clearAuthRateLimits(keys),
};

export const authenticationRateLimiter = createAuthenticationRateLimiter(
  sharedDatabaseStore,
  ENV.jwtSecret
);
