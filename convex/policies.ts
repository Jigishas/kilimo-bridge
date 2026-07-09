import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireTenant, getAuthenticatedUser } from "./lib/tenant";
import { audit } from "./lib/audit";
import { Id } from "./_generated/dataModel";

/**
 * Lists all policies for the authenticated user (cross-tenant for platform admins,
 * and tenant-isolated for tenant admins), joining farmer, product, and tenant details.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    let policies;
    if (user.role === "platform_admin" || !user.tenantId) {
      // Platform admin: load all policies
      policies = await ctx.db
        .query("policies")
        .order("desc")
        .take(100);
    } else {
      // Tenant admin: load tenant policies
      policies = await ctx.db
        .query("policies")
        .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId!))
        .order("desc")
        .take(100);
    }

    const results = [];
    for (const policy of policies) {
      const farmer = await ctx.db.get(policy.farmerId);
      const product = await ctx.db.get(policy.productId);
      const tenant = await ctx.db.get(policy.tenantId);
      results.push({
        ...policy,
        tenantName: tenant?.name ?? "Unknown Insurer",
        farmerName: farmer?.name ?? "Unknown Farmer",
        farmerPhone: farmer?.phone ?? "N/A",
        farmerCounty: farmer?.county ?? "N/A",
        productName: product?.name ?? "Unknown Product",
        productCounty: product?.county ?? "N/A",
      });
    }

    return results;
  },
});


/**
 * Returns KPIs for the authenticated tenant admin.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return {
        activeCount: 0,
        paidOutCount: 0,
        totalExposure: 0,
        totalPayouts: 0,
        activePremium: 0,
      };
    }

    let activePolicies;
    let paidOutPolicies;
    let payouts;

    if (user.role === "platform_admin" || !user.tenantId) {
      // Platform admin: aggregate across all tenants
      activePolicies = await ctx.db
        .query("policies")
        .filter((q) => q.eq(q.field("status"), "ACTIVE"))
        .collect();

      paidOutPolicies = await ctx.db
        .query("policies")
        .filter((q) => q.eq(q.field("status"), "PAID_OUT"))
        .collect();

      payouts = await ctx.db
        .query("payouts")
        .collect();
    } else {
      // Tenant admin: filter by tenantId
      const tenantId = user.tenantId;

      activePolicies = await ctx.db
        .query("policies")
        .withIndex("by_tenant_status", (q) =>
          q.eq("tenantId", tenantId).eq("status", "ACTIVE")
        )
        .collect();

      paidOutPolicies = await ctx.db
        .query("policies")
        .withIndex("by_tenant_status", (q) =>
          q.eq("tenantId", tenantId).eq("status", "PAID_OUT")
        )
        .collect();

      payouts = await ctx.db
        .query("payouts")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect();
    }

    const totalExposure = activePolicies.reduce((sum, p) => sum + p.sumInsured, 0);
    const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);
    const activePremium = activePolicies.reduce((sum, p) => sum + p.premiumPaid, 0);

    return {
      activeCount: activePolicies.length,
      paidOutCount: paidOutPolicies.length,
      totalExposure,
      totalPayouts,
      activePremium,
    };
  },
});


/**
 * Lists all active/paid out policies for a farmer by phone.
 * Used by USSD menu.
 */
export const getByFarmerPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const farmer = await ctx.db
      .query("farmers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();

    if (!farmer) return [];

    const policies = await ctx.db
      .query("policies")
      .withIndex("by_farmer", (q) => q.eq("farmerId", farmer._id))
      .collect();

    const results = [];
    for (const policy of policies) {
      if (policy.status === "ACTIVE" || policy.status === "PAID_OUT") {
        const product = await ctx.db.get(policy.productId);
        const tenant = await ctx.db.get(policy.tenantId);
        results.push({
          id: policy._id,
          insurerName: tenant?.name ?? "Mvua Shield Partner",
          productName: product?.name ?? "Crop Insurance",
          acres: policy.acres,
          premiumPaid: policy.premiumPaid,
          sumInsured: policy.sumInsured,
          status: policy.status,
        });
      }
    }
    return results;
  },
});

/**
 * Creates a policy with PENDING_PAYMENT status.
 * This is an internal mutation triggered by USSD/Payment checkout process.
 */
export const createPending = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    farmerId: v.id("farmers"),
    productId: v.id("products"),
    acres: v.number(),
    premiumPaid: v.number(),
    sumInsured: v.number(),
  },
  handler: async (ctx, args) => {
    const policyId = await ctx.db.insert("policies", {
      tenantId: args.tenantId,
      farmerId: args.farmerId,
      productId: args.productId,
      acres: args.acres,
      premiumPaid: args.premiumPaid,
      sumInsured: args.sumInsured,
      status: "PENDING_PAYMENT",
      purchaseDay: 0, // Not active yet
    });

    await audit(ctx, args.tenantId, {
      eventType: "PAYMENT_INITIATED",
      actor: `farmer:${(await ctx.db.get(args.farmerId))?.phone}`,
      entityRefs: { policyId, farmerId: args.farmerId },
      snapshot: { premium: args.premiumPaid, acres: args.acres },
    });

    return policyId;
  },
});

/**
 * Activates a policy after M-Pesa payment is confirmed.
 * Sets the purchase day clock to the current simulation index.
 */
export const activate = internalMutation({
  args: {
    policyId: v.id("policies"),
  },
  handler: async (ctx, args) => {
    const policy = await ctx.db.get(args.policyId);
    if (!policy) throw new Error("Policy not found");
    if (policy.status === "ACTIVE") return policy._id; // already active

    // Retrieve current simulation day
    const simState = await ctx.db.query("simulationState").unique();
    const currentDay = simState?.dayIndex ?? 0;

    await ctx.db.patch(args.policyId, {
      status: "ACTIVE",
      purchaseDay: currentDay,
    });

    await audit(ctx, policy.tenantId, {
      eventType: "POLICY_ACTIVATED",
      actor: "system:mpesa-callback",
      entityRefs: { policyId: args.policyId, farmerId: policy.farmerId },
      snapshot: { purchaseDay: currentDay },
    });

    return args.policyId;
  },
});

/**
 * Manually registers a farmer (if new) and issues an active crop insurance policy.
 */
export const createManualPolicy = mutation({
  args: {
    farmerName: v.string(),
    farmerPhone: v.string(),
    farmerCounty: v.string(),
    productId: v.id("products"),
    acres: v.number(),
  },
  handler: async (ctx, args) => {
    const tenantId = await requireTenant(ctx);

    // 1. Get or create farmer profile
    let farmer = await ctx.db
      .query("farmers")
      .withIndex("by_phone", (q) => q.eq("phone", args.farmerPhone))
      .unique();

    if (!farmer) {
      const farmerId = await ctx.db.insert("farmers", {
        name: args.farmerName,
        phone: args.farmerPhone,
        county: args.farmerCounty,
        language: "en",
        consentRecord: {
          text: "Consent captured via offline manual agent registration form.",
          acceptedAt: Date.now(),
        },
      });
      farmer = (await ctx.db.get(farmerId))!;
    }


    // 2. Get product details to compute premium and sum insured
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    const premiumPaid = product.premiumPerAcre * args.acres;
    const sumInsured = product.sumInsuredPerAcre * args.acres;

    // Retrieve current simulation day
    const simState = await ctx.db.query("simulationState").unique();
    const currentDay = simState?.dayIndex ?? 18;

    // 3. Create active policy
    const policyId = await ctx.db.insert("policies", {
      tenantId,
      farmerId: farmer._id,
      productId: product._id,
      acres: args.acres,
      premiumPaid,
      sumInsured,
      status: "ACTIVE",
      purchaseDay: currentDay,
    });

    // 4. Log audit event
    await audit(ctx, tenantId, {
      eventType: "POLICY_ACTIVATED",
      actor: "tenant_admin",
      entityRefs: { policyId, farmerId: farmer._id },
      snapshot: { acres: args.acres, premiumPaid, sumInsured, productId: product._id },
    });

    return policyId;
  },
});


