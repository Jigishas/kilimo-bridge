import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { audit } from "./lib/audit";
import { Id } from "./_generated/dataModel";

interface Phase {
  name: string;
  startDay: number;
  endDay: number;
  thresholdMm: number;
  payoutPct: number;
}

interface Reading {
  dayIndex: number;
  rainfallMm: number;
}

/**
 * Pure actuarial function to evaluate if a trigger phase has been breached.
 * Enforces inclusive <= operator (farmer-favouring) and checks phase boundaries.
 */
export function evaluateTrigger(
  phase: Phase,
  readings: Reading[],
  currentDay: number
): { breached: boolean; cumulativeMm: number } {
  // If the season clock hasn't reached the end of the phase, do not trigger yet
  if (currentDay < phase.endDay) {
    return { breached: false, cumulativeMm: 0 };
  }

  // Calculate cumulative rainfall during this specific phase
  const phaseReadings = readings.filter(
    (r) => r.dayIndex >= phase.startDay && r.dayIndex <= phase.endDay
  );

  const cumulativeMm = phaseReadings.reduce((sum, r) => sum + r.rainfallMm, 0);

  // Breach occurs if cumulative rainfall is less than or equal to threshold
  const breached = cumulativeMm <= phase.thresholdMm;

  return { breached, cumulativeMm };
}

/**
 * Platform mutation called when weather data is updated or simulation advances.
 * Evaluates all ACTIVE policies across all tenants.
 * This is a cross-tenant operation executed asPlatformAdmin.
 */
export const fireTriggers = internalMutation({
  args: {
    currentDay: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Get all active policies
    const activePolicies = await ctx.db
      .query("policies")
      .filter((q) => q.eq(q.field("status"), "ACTIVE"))
      .collect();

    let payoutsCreated = 0;

    for (const policy of activePolicies) {
      const product = await ctx.db.get(policy.productId);
      if (!product) continue;

      // 2. Fetch weather readings for the product's county
      const readings = await ctx.db
        .query("weatherReadings")
        .withIndex("by_county_day", (q) => q.eq("county", product.county))
        .collect();

      const triggerRule = product.triggerRule;

      for (const phase of triggerRule.phases) {
        const { breached, cumulativeMm } = evaluateTrigger(
          phase,
          readings,
          args.currentDay
        );

        if (breached) {
          // Double-fire guard: check if payout already exists for this policy and phase
          const existingPayouts = await ctx.db
            .query("payouts")
            .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
            .collect();

          const alreadyPaid = existingPayouts.some(
            (p) => p.triggerSnapshot.phaseName === phase.name
          );

          if (alreadyPaid) {
            continue; // Skip to avoid double payment
          }

          // Calculate payout amount based on policy sumInsured and phase percentage
          const amount = policy.sumInsured * phase.payoutPct;

          // 3. Create payout
          const payoutId = await ctx.db.insert("payouts", {
            tenantId: policy.tenantId,
            policyId: policy._id,
            amount,
            status: "SENT",
            triggerSnapshot: {
              phaseName: phase.name,
              dayIndex: args.currentDay,
              cumulativeMm,
              thresholdMm: phase.thresholdMm,
              payoutPct: phase.payoutPct,
            },
          });

          // 4. Update policy status
          // In this hackathon scope, any payout triggers a PAID_OUT status
          await ctx.db.patch(policy._id, {
            status: "PAID_OUT",
          });

          // 5. Write audit log
          await audit(ctx, policy.tenantId, {
            eventType: "TRIGGER_FIRED",
            actor: "system:trigger-engine",
            entityRefs: { policyId: policy._id, payoutId },
            snapshot: {
              phaseName: phase.name,
              cumulativeMm,
              thresholdMm: phase.thresholdMm,
              payoutAmount: amount,
            },
          });

          // 6. Enqueue SMS notification
          const farmer = await ctx.db.get(policy.farmerId);
          const tenant = await ctx.db.get(policy.tenantId);
          if (farmer && tenant) {
            const smsText = `${tenant.brandConfig.senderLabel.toUpperCase()}: Drought detected in ${product.county} (${phase.name} Phase: cumulative rainfall ${cumulativeMm}mm vs ${phase.thresholdMm}mm threshold). KES ${amount.toLocaleString()} payout sent to your M-Pesa. No claim needed.`;
            
            await ctx.db.insert("auditLog", {
              tenantId: policy.tenantId,
              eventType: "SMS_SENT",
              actor: "system:notifier",
              entityRefs: { policyId: policy._id, farmerId: farmer._id, payoutId },
              snapshot: { phone: farmer.phone, message: smsText },
              timestamp: Date.now(),
            });
          }

          payoutsCreated++;
        }
      }
    }

    return { payoutsCreated };
  },
});
