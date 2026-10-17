import { describe, expect, it } from "vitest";
import { getSecurityHeaders } from "./securityHeaders";

describe("security response headers", () => {
  it("sets compatible baseline headers without imposing a CSP", () => {
    const headers = getSecurityHeaders({
      isProduction: false,
      requestIsSecure: false,
    });
    expect(headers).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    expect(headers["Content-Security-Policy"]).toBeUndefined();
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });

  it("adds HSTS only on production HTTPS requests", () => {
    expect(
      getSecurityHeaders({ isProduction: true, requestIsSecure: true })[
        "Strict-Transport-Security"
      ]
    ).toBe("max-age=15552000");
    expect(
      getSecurityHeaders({ isProduction: true, requestIsSecure: false })[
        "Strict-Transport-Security"
      ]
    ).toBeUndefined();
  });
});
