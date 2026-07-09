import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser } from "./lib/tenant";

/**
 * Returns the current authenticated tenant's information (for dashboards).
 */
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    if (!user.tenantId) {
      // Platform admin has no single tenant context
      return {
        isPlatformAdmin: true,
        tenant: null,
      };
    }

    const tenant = await ctx.db.get(user.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    return {
      isPlatformAdmin: false,
      tenant,
    };
  },
});

/**
 * Lists all active tenants (platform-admin query or public selector).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    // Can be called by platform admin or login screen
    const tenants = await ctx.db.query("tenants").collect();
    return tenants.filter((t) => t.status === "active");
  },
});

/**
 * Gets a specific tenant's brand configuration by their ID.
 */
export const getById = query({
  args: { id: v.id("tenants") },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.id);
    if (!tenant) return null;
    return tenant;
  },
});

/**
 * Gets a specific tenant's brand configuration by slug.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return tenant;
  },
});
