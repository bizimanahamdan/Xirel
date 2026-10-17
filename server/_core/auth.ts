import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

const SALT_ROUNDS = 10;
let dummyPasswordHashPromise: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** A valid bcrypt hash used to keep unknown-account logins on the same path. */
export function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHashPromise ??= hashPassword(`invalid-account-${randomUUID()}`);
  return dummyPasswordHashPromise;
}

function getSecretKey() {
  return new TextEncoder().encode(ENV.jwtSecret);
}

export async function createSessionToken(
  userId: number,
  expiresInMs: number = ENV.sessionTtlMs
): Promise<string> {
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new Error("Cannot create a session for an invalid user id.");
  }
  if (!Number.isSafeInteger(expiresInMs) || expiresInMs < 1) {
    throw new Error("Session lifetime must be a positive integer.");
  }

  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expirationSeconds)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<number | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const userId = payload.userId;
    const expiration = payload.exp;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      !Number.isSafeInteger(userId) ||
      (userId as number) < 1 ||
      !Number.isSafeInteger(expiration) ||
      (expiration as number) <= nowSeconds
    ) {
      return null;
    }

    // Tokens created before the shorter TTL had no iat claim and used a
    // one-year expiration. Infer their issuance time so the configured maximum
    // age is enforced immediately after rollout rather than only on new tokens.
    const legacyOneYearSeconds = 365 * 24 * 60 * 60;
    const issuedAt = Number.isSafeInteger(payload.iat)
      ? (payload.iat as number)
      : (expiration as number) - legacyOneYearSeconds;
    const maximumAgeSeconds = Math.floor(ENV.sessionTtlMs / 1000);
    if (issuedAt > nowSeconds || nowSeconds - issuedAt > maximumAgeSeconds)
      return null;

    return userId as number;
  } catch {
    // Invalid, expired, and incorrectly signed session cookies are expected
    // unauthenticated input; never log or echo the token itself.
    return null;
  }
}
