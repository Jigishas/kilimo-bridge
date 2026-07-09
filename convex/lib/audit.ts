import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export type AuditEvent = {
  eventType:
    | "FARMER_REGISTERED"
    | "CONSENT_CAPTURED"
    | "PAYMENT_INITIATED"
    | "PAYMENT_CONFIRMED"
    | "POLICY_ACTIVATED"
    | "TRIGGER_EVALUATED"
    | "TRIGGER_FIRED"
    | "PAYOUT_SENT"
    | "SMS_SENT";
  actor: string;
  entityRefs?: {
    policyId?: Id<"policies">;
    farmerId?: Id<"farmers">;
    payoutId?: Id<"payouts">;
    paymentIntentId?: Id<"paymentIntents">;
  };
  snapshot?: any;
};

/**
 * Records an audit log entry in the database.
 * This should be executed within a Convex mutation transaction.
 */
export async function audit(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  event: AuditEvent
) {
  await ctx.db.insert("auditLog", {
    tenantId,
    eventType: event.eventType,
    actor: event.actor,
    entityRefs: {
      policyId: event.entityRefs?.policyId,
      farmerId: event.entityRefs?.farmerId,
      payoutId: event.entityRefs?.payoutId,
      paymentIntentId: event.entityRefs?.paymentIntentId,
    },
    snapshot: event.snapshot ?? null,
    timestamp: Date.now(),
  });
}
