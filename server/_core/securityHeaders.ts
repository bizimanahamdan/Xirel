import type { NextFunction, Request, Response } from "express";
import { ENV } from "./env";

/** Conservative browser headers that do not impose a brittle CSP on the storefront. */
export function getSecurityHeaders(options: {
  isProduction: boolean;
  requestIsSecure: boolean;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  // The app runs behind an HTTPS-terminating proxy in production. Express's
  // trusted-proxy configuration is set before this middleware is mounted.
  if (options.isProduction && options.requestIsSecure) {
    headers["Strict-Transport-Security"] = "max-age=15552000";
  }

  return headers;
}

export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  for (const [name, value] of Object.entries(
    getSecurityHeaders({
      isProduction: ENV.isProduction,
      requestIsSecure: req.secure,
    })
  )) {
    res.setHeader(name, value);
  }

  next();
}
