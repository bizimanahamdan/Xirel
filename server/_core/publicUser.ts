import type { User } from "../../drizzle/schema";

export type PublicUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "createdAt" | "updatedAt" | "lastSignedIn"
>;

/** Explicit allowlist for user data returned by API procedures. */
export function serializePublicUser(user: User): PublicUser;
export function serializePublicUser(user: User | null): PublicUser | null;
export function serializePublicUser(
  user: User | undefined
): PublicUser | undefined;
export function serializePublicUser(
  user: User | null | undefined
): PublicUser | null | undefined {
  if (!user) return user;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSignedIn: user.lastSignedIn,
  };
}
