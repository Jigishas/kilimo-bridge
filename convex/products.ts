import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireTenant } from "./lib/tenant";

/**
 * Lists all active products for the logged-in tenant.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const tenantId = await requireTenant(ctx);

    const products = await ctx.db
      .query("products")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    return products.filter((p) => p.status === "active");
  },
});

/**
 * Lists products for a specific tenant and county.
 * Used by the USSD menu flow (anonymous callback, takes tenantId).
 */
export const getByTenantAndCounty = query({
  args: { tenantId: v.id("tenants"), county: v.string() },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_tenant_county", (q) =>
        q.eq("tenantId", args.tenantId).eq("county", args.county)
      )
      .collect();

    return products.filter((p) => p.status === "active");
  },
});

/**
 * Lists all active products for a specific tenant.
 * Used by the USSD menu flow (anonymous callback, takes tenantId).
 */
export const getByTenant = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    return products.filter((p) => p.status === "active");
  },
});

/**
 * Gets a product by ID.
 */
export const get = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id);
    if (!product) return null;
    return product;
  },
});
