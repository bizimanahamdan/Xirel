import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { verifySessionToken } from "./auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const cookies = parseCookieHeader(opts.req.headers.cookie ?? "");
  const sessionCookie = cookies[COOKIE_NAME];
  const userId = await verifySessionToken(sessionCookie);

  // Invalid or expired cookies resolve to an anonymous request. Database
  // failures are deliberately allowed to propagate instead of being hidden
  // as an unauthenticated public request.
  const user = userId ? ((await db.getUserById(userId)) ?? null) : null;

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
