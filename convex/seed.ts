import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { audit } from "./lib/audit";
import { Id } from "./_generated/dataModel";

/**
 * Seeder mutation to initialize the database with mock tenants, users, products,
 * farmers, active policies, and rainfall history for Kitui.
 * Executable from the CLI: npx convex run seed:run
 */
export const run = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("Seeding database...");

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

    // 1. Seed Tenants
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

    console.log("Seeded tenants...");

    // 2. Seed Custom User Records
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

    console.log("Seeded user profiles...");

    // 3. Seed Products
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

    console.log("Seeded products...");

    // 4. Seed Farmers
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

    console.log("Seeded farmers...");

    // 5. Seed Active Policies (12 for Kilimo Sure, 8 for Mavuno Cover)
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

    console.log("Seeded active policies...");

    // 6. Seed Weather Readings for Kitui county (Days 1 to 18)
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

    console.log("Seeded rainfall history...");

    // 7. Seed simulation clock state
    await ctx.db.insert("simulationState", {
      dayIndex: 18,
      scenarioName: "Kitui Drought 2026",
    });

    console.log("Seeded simulation state clock.");
    console.log("Database seeded successfully!");
    return { success: true };
  },
});
