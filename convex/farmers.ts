import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { audit } from "./lib/audit";

/**
 * Registers a farmer or updates their profile and consent details.
 * This operation is idempotent on phone number.
 * It is called by the USSD engine which passes the bound tenantId.
 */
export const register = mutation({
  args: {
    phone: v.string(),
    name: v.string(),
    county: v.string(),
    language: v.union(v.literal("en"), v.literal("sw")),
    consentText: v.string(),
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const existingFarmer = await ctx.db
      .query("farmers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();

    const timestamp = Date.now();
    const consentRecord = {
      text: args.consentText,
      acceptedAt: timestamp,
    };

    let farmerId;

    if (existingFarmer) {
      farmerId = existingFarmer._id;
      await ctx.db.patch(farmerId, {
        name: args.name,
        county: args.county,
        language: args.language,
        consentRecord,
      });

      // Audit farmer update
      await audit(ctx, args.tenantId, {
        eventType: "FARMER_REGISTERED",
        actor: `farmer:${args.phone}`,
        entityRefs: { farmerId },
        snapshot: { action: "update", name: args.name, county: args.county },
      });
    } else {
      farmerId = await ctx.db.insert("farmers", {
        phone: args.phone,
        name: args.name,
        county: args.county,
        language: args.language,
        consentRecord,
      });

      // Audit farmer creation
      await audit(ctx, args.tenantId, {
        eventType: "FARMER_REGISTERED",
        actor: `farmer:${args.phone}`,
        entityRefs: { farmerId },
        snapshot: { action: "create", name: args.name, county: args.county },
      });
    }

    // Audit the consent capture specifically for RegTech validation
    await audit(ctx, args.tenantId, {
      eventType: "CONSENT_CAPTURED",
      actor: `farmer:${args.phone}`,
      entityRefs: { farmerId },
      snapshot: { consentText: args.consentText, timestamp },
    });

    return farmerId;
  },
});

/**
 * Looks up a farmer by their phone number.
 */
export const getByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("farmers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();
  },
});

/**
 * Gets a farmer by their ID.
 */
export const get = query({
  args: { id: v.id("farmers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
