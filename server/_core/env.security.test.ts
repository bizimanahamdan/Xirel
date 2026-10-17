import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { JwtSecretConfigurationError, resolveJwtSecret } from "./env";

describe("JWT_SECRET configuration", () => {
  it("fails production startup when the secret is missing", () => {
    expect(() => resolveJwtSecret("production", undefined, vi.fn())).toThrow(
      JwtSecretConfigurationError
    );
    expect(() => resolveJwtSecret("production", "", vi.fn())).toThrow(
      /JWT_SECRET is required/
    );
  });

  it("rejects weak, placeholder, repeated, and predictable secrets", () => {
    const warn = vi.fn();
    for (const secret of [
      "short",
      "change-me-to-a-long-random-string",
      "x".repeat(64),
      "abcdefghijklmnopqrstuvwxyz0123456789",
      "your-jwt-secret-" + "x".repeat(48),
    ]) {
      expect(() => resolveJwtSecret("production", secret, warn)).toThrow(
        JwtSecretConfigurationError
      );
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it("accepts a sufficiently strong production secret without logging its value", () => {
    const secret = randomBytes(48).toString("base64url");
    const warn = vi.fn();

    expect(resolveJwtSecret("production", secret, warn)).toBe(secret);
    expect(warn).not.toHaveBeenCalled();
  });

  it("uses and warns about a development-only fallback when no key is configured", () => {
    const warn = vi.fn();
    const fallback = resolveJwtSecret("development", undefined, warn);

    expect(fallback).toContain("development-only");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).not.toContain(fallback);
  });

  it("uses a separate silent fallback in the test environment", () => {
    const warn = vi.fn();
    expect(resolveJwtSecret("test", undefined, warn)).toContain("test-only");
    expect(warn).not.toHaveBeenCalled();
  });

  it("fails module initialization at production startup when JWT_SECRET is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "");
    vi.resetModules();

    try {
      await expect(import("./env")).rejects.toThrow(
        /JWT_SECRET is required when NODE_ENV=production/
      );
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
