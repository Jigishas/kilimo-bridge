import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireTenant, getAuthenticatedUser } from "./lib/tenant";


/**
 * Lists all active products for the logged-in tenant.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    if (user.role === "platform_admin" || !user.tenantId) {
      return [];
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId!))
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

/**
 * Creates a new active crop insurance product.
 */
export const create = mutation({
  args: {
    name: v.string(),
    county: v.string(),
    cropType: v.string(),
    premiumPerAcre: v.number(),
    sumInsuredPerAcre: v.number(),
    phase1Threshold: v.number(),
    phase2Threshold: v.number(),
  },
  handler: async (ctx, args) => {
    const tenantId = await requireTenant(ctx);

    const productId = await ctx.db.insert("products", {
      tenantId,
      name: args.name,
      county: args.county,
      cropType: args.cropType,
      premiumPerAcre: args.premiumPerAcre,
      sumInsuredPerAcre: args.sumInsuredPerAcre,
      triggerRule: {
        phases: [
          {
            name: "Germination Phase",
            startDay: 1,
            endDay: 21,
            thresholdMm: args.phase1Threshold,
            payoutPct: 1.0,
          },
          {
            name: "Vegetative Phase",
            startDay: 22,
            endDay: 45,
            thresholdMm: args.phase2Threshold,
            payoutPct: 1.0,
          },
        ],
      },
      status: "active",
    });

    return productId;
  },
});

