import { describe, expect, it } from "vitest";
import { createSessionCookieOptions } from "./cookies";

describe("session cookie options", () => {
  it("uses HttpOnly, host-only, root-path, and SameSite=Lax defaults", () => {
    expect(
      createSessionCookieOptions({
        isProduction: false,
        requestIsSecure: false,
      })
    ).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it("always marks production cookies Secure even behind a TLS proxy", () => {
    expect(
      createSessionCookieOptions({ isProduction: true, requestIsSecure: false })
    ).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("supports an explicitly configured cookie domain without changing the host-only default", () => {
    expect(
      createSessionCookieOptions({
        isProduction: true,
        requestIsSecure: true,
        domain: ".example.com",
      }).domain
    ).toBe(".example.com");
  });
});
