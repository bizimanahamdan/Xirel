import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

type SessionCookieOptions = Pick<
  CookieOptions,
  "domain" | "httpOnly" | "path" | "sameSite" | "secure"
>;

function isSecureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");
  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function createSessionCookieOptions(options: {
  isProduction: boolean;
  requestIsSecure: boolean;
  domain?: string;
}): SessionCookieOptions {
  return {
    httpOnly: true,
    path: "/",
    // Lax preserves same-site checkout/login navigation while limiting CSRF.
    sameSite: "lax",
    secure: options.isProduction || options.requestIsSecure,
    ...(options.domain ? { domain: options.domain } : {}),
  };
}

export function getSessionCookieOptions(req: Request): SessionCookieOptions {
  return createSessionCookieOptions({
    isProduction: ENV.isProduction,
    requestIsSecure: isSecureRequest(req),
    domain: ENV.sessionCookieDomain || undefined,
  });
}
