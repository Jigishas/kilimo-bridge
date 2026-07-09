import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Resolves the authenticated user's custom user document.
 * Checks both tokenIdentifier (best practice) and authSubject.
 */
export async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // Lookup custom user record by tokenIdentifier or authSubject
  let user = await ctx.db
    .query("users")
    .withIndex("by_authSubject", (q) => q.eq("authSubject", identity.tokenIdentifier))
    .unique();

  if (user) return user;

  // Try by subject (Better Auth ID)
  user = await ctx.db
    .query("users")
    .withIndex("by_authSubject", (q) => q.eq("authSubject", identity.subject))
    .unique();

  if (user) return user;

  // Fallback check on email (convenient for seeded users)
  if (identity.email) {
    const userByEmail = await ctx.db
      .query("users")
      .withIndex("by_authSubject") // scan or filter if index not matched
      .filter((q) => q.eq(q.field("email"), identity.email))
      .unique();
    return userByEmail;
  }

  return null;
}

/**
 * Enforces that the caller is authenticated and belongs to a specific tenant.
 * Returns the tenantId. Refuses to run if user is not a tenant admin.
 */
export async function requireTenant(ctx: QueryCtx | MutationCtx): Promise<Id<"tenants">> {
  const user = await getAuthenticatedUser(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  if (!user.tenantId) {
    throw new Error("User has no tenant context (Platform Admin)");
  }
  return user.tenantId;
}

/**
 * Enforces that the caller is an authenticated Platform Admin.
 */
export async function requirePlatformAdmin(ctx: QueryCtx | MutationCtx): Promise<void> {
  const user = await getAuthenticatedUser(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  if (user.role !== "platform_admin" || user.tenantId !== undefined) {
    throw new Error("Unauthorized: Platform Admin access required");
  }
}
