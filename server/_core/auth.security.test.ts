import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from "./auth";
import { ENV } from "./env";

describe("session authentication", () => {
  it("verifies the existing bcrypt password-hash algorithm", async () => {
    const password = "correct-horse-battery-staple";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    expect(await verifyPassword(password, passwordHash)).toBe(true);
    expect(await verifyPassword("incorrect-password", passwordHash)).toBe(
      false
    );
  });

  it("accepts a valid HS256 session token and rejects it when expired", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(start);
    try {
      const token = await createSessionToken(42, 10_000);
      expect(await verifySessionToken(token)).toBe(42);

      vi.setSystemTime(new Date(start.getTime() + 11_000));
      expect(await verifySessionToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("enforces the configured maximum age for sessions", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-02-01T00:00:00.000Z");
    vi.setSystemTime(start);
    try {
      const token = await createSessionToken(7, ENV.sessionTtlMs * 2);
      vi.setSystemTime(new Date(start.getTime() + ENV.sessionTtlMs + 2_000));
      expect(await verifySessionToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects malformed signatures and unexpected signing algorithms", async () => {
    const token = await createSessionToken(11, 60_000);
    const [header, payload, signature] = token.split(".");
    const badSignature = `${header}.${payload}.${signature?.endsWith("a") ? "b" : "a"}`;
    expect(await verifySessionToken(badSignature)).toBeNull();

    const unexpectedAlgorithmToken = await new SignJWT({ userId: 11 })
      .setProtectedHeader({ alg: "HS512", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(Math.floor((Date.now() + 60_000) / 1000))
      .sign(new TextEncoder().encode(ENV.jwtSecret));
    expect(await verifySessionToken(unexpectedAlgorithmToken)).toBeNull();
  });
});
