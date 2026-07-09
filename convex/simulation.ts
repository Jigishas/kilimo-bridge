import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requirePlatformAdmin } from "./lib/tenant";
import { audit } from "./lib/audit";
import { Id } from "./_generated/dataModel";

/**
 * Returns the current simulation clock state.
 */
export const getState = query({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db.query("simulationState").unique();
    return state || { dayIndex: 18, scenarioName: "Kitui Drought 2026" };
  },
});

/**
 * Advances the simulation by 1 day.
 * Appends the weather reading for the new day, increments the clock,
 * and executes trigger checking for active policies.
 * Gated to Platform Admin.
 */
export const advanceDay = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);

    const simState = await ctx.db.query("simulationState").unique();
    const currentDay = simState?.dayIndex ?? 18;
    const newDay = currentDay + 1;

    // 1. Update clock
    if (simState) {
      await ctx.db.patch(simState._id, { dayIndex: newDay });
    } else {
      await ctx.db.insert("simulationState", {
        dayIndex: newDay,
        scenarioName: "Kitui Drought 2026",
      });
    }

    // 2. Append rainfall for the new day (drought scenario: 0mm for days 19, 20, 21)
    const rainfallMm = 0; // We simulate drought condition
    const previousReading = await ctx.db
      .query("weatherReadings")
      .withIndex("by_county_day", (q) =>
        q.eq("county", "Kitui").eq("dayIndex", currentDay)
      )
      .unique();

    const previousCumulative = previousReading?.cumulativeMm ?? 12;
    const newCumulative = previousCumulative + rainfallMm;

    await ctx.db.insert("weatherReadings", {
      county: "Kitui",
      dayIndex: newDay,
      rainfallMm,
      cumulativeMm: newCumulative,
    });

    // 3. Fire parametric trigger engine
    const triggerResult: { payoutsCreated: number } = await ctx.runMutation(
      internal.trigger.fireTriggers,
      { currentDay: newDay }
    );

    // Get any tenant to register audit (we just log under platform admin context)
    const platformTenant = await ctx.db.query("tenants").first();
    if (platformTenant) {
      await audit(ctx, platformTenant._id, {
        eventType: "TRIGGER_EVALUATED",
        actor: "system:clock",
        snapshot: { dayIndex: newDay, rainfallMm, cumulativeMm: newCumulative, ...triggerResult },
      });
    }

    return {
      dayIndex: newDay,
      rainfallMm,
      cumulativeMm: newCumulative,
      payoutsCreated: triggerResult.payoutsCreated,
    };
  },
});

/**
 * Resets the entire database and repopulates the seed data.
 * Gated to Platform Admin.
 */
export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);

    // 1. Wipe all tables
    const tables = [
      "tenants",
      "users",
      "products",
      "farmers",
      "policies",
      "paymentIntents",
      "payouts",
      "weatherReadings",
      "auditLog",
      "ussdSessions",
      "simulationState",
    ] as const;

    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }

    // 2. Seed Tenants
    const kilimoSureId = await ctx.db.insert("tenants", {
      name: "Kilimo Sure",
      slug: "kilimo-sure",
      brandConfig: {
        senderLabel: "KilimoSure",
        primaryColor: "#16a34a", // Green
        ussdDisplayName: "Kilimo Sure",
      },
      status: "active",
    });

    const mavunoCoverId = await ctx.db.insert("tenants", {
      name: "Mavuno Cover",
      slug: "mavuno-cover",
      brandConfig: {
        senderLabel: "MavunoCover",
        primaryColor: "#ea580c", // Amber
        ussdDisplayName: "Mavuno Cover",
      },
      status: "active",
    });

    // 3. Seed Custom User Records
    await ctx.db.insert("users", {
      name: "Platform Admin",
      email: "admin@mvua.shield",
      role: "platform_admin",
      authSubject: "platform-admin-subject",
    });

    await ctx.db.insert("users", {
      tenantId: kilimoSureId,
      name: "Kilimo Sure Admin",
      email: "admin@kilimosure.co.ke",
      role: "tenant_admin",
      authSubject: "kilimo-sure-admin-subject",
    });

    await ctx.db.insert("users", {
      tenantId: mavunoCoverId,
      name: "Mavuno Cover Admin",
      email: "admin@mavunocover.co.ke",
      role: "tenant_admin",
      authSubject: "mavuno-cover-admin-subject",
    });

    // 4. Seed Products
    const triggerRule = {
      phases: [
        {
          name: "Germination",
          startDay: 1,
          endDay: 21,
          thresholdMm: 15, // Cumulative rainfall threshold
          payoutPct: 0.3,  // 30% payout
        },
        {
          name: "Vegetative",
          startDay: 22,
          endDay: 45,
          thresholdMm: 40,
          payoutPct: 0.7,  // 70% payout
        },
      ],
    };

    const kilimoProductId = await ctx.db.insert("products", {
      tenantId: kilimoSureId,
      name: "Maize Drought Index — Kitui",
      county: "Kitui",
      cropType: "maize",
      premiumPerAcre: 800,
      sumInsuredPerAcre: 10000,
      triggerRule,
      status: "active",
    });

    const mavunoProductId = await ctx.db.insert("products", {
      tenantId: mavunoCoverId,
      name: "Maize Drought Index — Kitui",
      county: "Kitui",
      cropType: "maize",
      premiumPerAcre: 800,
      sumInsuredPerAcre: 10000,
      triggerRule,
      status: "active",
    });

    // 5. Seed Farmers
    const farmerNames = [
      "John Mutua", "Mary Mwende", "Peter Musyoka", "Esther Nzilani",
      "James Mwendwa", "Grace Kalekye", "David Kioko", "Ruth Syombua",
      "Samuel Mbiti", "Alice Mutio", "Joseph Kilonzo", "Faustina Ndunge",
      "Boniface Wambua", "Teresa Mwethya", "Paul Mutisya", "Cecilia Ndinda",
      "Michael Munuve", "Agnes Syonthi", "Emmanuel Musili", "Mercy Nduku"
    ];

    const farmerIds: Id<"farmers">[] = [];
    for (let i = 0; i < farmerNames.length; i++) {
      const suffix = String(i + 1).padStart(3, "0");
      const farmerId = await ctx.db.insert("farmers", {
        phone: `+254711000${suffix}`,
        name: farmerNames[i],
        county: "Kitui",
        language: i % 2 === 0 ? "en" : "sw",
        consentRecord: {
          text: "I consent to share my crop details for Mvua Shield cover",
          acceptedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
        },
      });
      farmerIds.push(farmerId);
    }

    // 6. Seed Active Policies (12 for Kilimo Sure, 8 for Mavuno Cover)
    // Kilimo Sure (Green Brand)
    for (let i = 0; i < 12; i++) {
      const acres = 2 + (i % 4); // 2 to 5 acres
      await ctx.db.insert("policies", {
        tenantId: kilimoSureId,
        farmerId: farmerIds[i],
        productId: kilimoProductId,
        acres,
        premiumPaid: acres * 800,
        sumInsured: acres * 10000,
        status: "ACTIVE",
        purchaseDay: 1,
      });

      await audit(ctx, kilimoSureId, {
        eventType: "POLICY_ACTIVATED",
        actor: "system:seeder",
        entityRefs: { farmerId: farmerIds[i] },
        snapshot: { acres, status: "seeded" },
      });
    }

    // Mavuno Cover (Amber Brand)
    for (let i = 12; i < 20; i++) {
      const acres = 2 + (i % 4); // 2 to 5 acres
      await ctx.db.insert("policies", {
        tenantId: mavunoCoverId,
        farmerId: farmerIds[i],
        productId: mavunoProductId,
        acres,
        premiumPaid: acres * 800,
        sumInsured: acres * 10000,
        status: "ACTIVE",
        purchaseDay: 1,
      });

      await audit(ctx, mavunoCoverId, {
        eventType: "POLICY_ACTIVATED",
        actor: "system:seeder",
        entityRefs: { farmerId: farmerIds[i] },
        snapshot: { acres, status: "seeded" },
      });
    }

    // 7. Seed Weather Readings for Kitui county (Days 1 to 18)
    // Rainfall schedule totaling 12mm across 18 days
    const rainSchedule: Record<number, number> = {
      3: 3, // day 3: 3mm
      7: 4, // day 7: 4mm
      12: 5, // day 12: 5mm
    };

    let cumulativeMm = 0;
    for (let day = 1; day <= 18; day++) {
      const rainfallMm = rainSchedule[day] ?? 0;
      cumulativeMm += rainfallMm;

      await ctx.db.insert("weatherReadings", {
        county: "Kitui",
        dayIndex: day,
        rainfallMm,
        cumulativeMm,
      });
    }

    // 8. Seed simulation clock state
    await ctx.db.insert("simulationState", {
      dayIndex: 18,
      scenarioName: "Kitui Drought 2026",
    });

    return { success: true };
  },
});

/**
 * Returns weather readings for a given county, sorted by dayIndex.
 */
export const getWeatherReadings = query({
  args: { county: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("weatherReadings")
      .withIndex("by_county_day", (q) => q.eq("county", args.county))
      .order("asc")
      .collect();
  },
});

