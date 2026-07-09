import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";

/**
 * Initiates an M-Pesa STK Push intent.
 * Calculates premium, generates a unique checkoutRequestId, and registers the intent.
 */
export const initiate = mutation({
  args: {
    tenantId: v.id("tenants"),
    farmerId: v.id("farmers"),
    productId: v.id("products"),
    acres: v.number(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    const amount = args.acres * product.premiumPerAcre;
    const checkoutRequestId = `wsr_${Math.random().toString(36).substring(2, 15)}`;

    const paymentIntentId = await ctx.db.insert("paymentIntents", {
      tenantId: args.tenantId,
      checkoutRequestId,
      phone: args.phone,
      amount,
      policyDraft: {
        farmerId: args.farmerId,
        productId: args.productId,
        acres: args.acres,
      },
      status: "PENDING",
    });

    await audit(ctx, args.tenantId, {
      eventType: "PAYMENT_INITIATED",
      actor: `farmer:${args.phone}`,
      entityRefs: { paymentIntentId, farmerId: args.farmerId },
      snapshot: { amount, checkoutRequestId },
    });

    return {
      paymentIntentId,
      checkoutRequestId,
      amount,
    };
  },
});

/**
 * Internal mutation to process Safaricom / Webhook callback.
 * Gated by checkoutRequestId. Performs policy creation and activation upon success.
 */
export const confirmPayment = internalMutation({
  args: {
    checkoutRequestId: v.string(),
    resultCode: v.number(), // 0 = success
    resultDescription: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    policyId: Id<"policies"> | null;
    status: string;
    reason?: string;
  }> => {
    const intent = await ctx.db
      .query("paymentIntents")
      .withIndex("by_checkoutRequestId", (q) =>
        q.eq("checkoutRequestId", args.checkoutRequestId)
      )
      .unique();

    if (!intent) {
      console.warn(`Payment intent not found for CheckoutRequestID: ${args.checkoutRequestId}`);
      return { success: false, reason: "not_found", policyId: null, status: "FAILED" };
    }

    if (intent.status !== "PENDING") {
      console.log(`Payment intent ${args.checkoutRequestId} already processed (status: ${intent.status})`);
      return { success: true, policyId: null, status: intent.status };
    }

    const success = args.resultCode === 0;
    const finalStatus = success ? "PAID" : "FAILED";

    await ctx.db.patch(intent._id, {
      status: finalStatus,
      resultDescription: args.resultDescription,
    });

    await audit(ctx, intent.tenantId, {
      eventType: "PAYMENT_CONFIRMED",
      actor: "system:mpesa-callback",
      entityRefs: { paymentIntentId: intent._id },
      snapshot: { resultCode: args.resultCode, description: args.resultDescription },
    });

    if (success) {
      // Calculate Sum Insured
      const product = await ctx.db.get(intent.policyDraft.productId);
      if (!product) throw new Error("Product in policy draft not found");

      const sumInsured = intent.policyDraft.acres * product.sumInsuredPerAcre;

      // 1. Create Pending Policy
      const policyId: Id<"policies"> = await ctx.runMutation(internal.policies.createPending, {
        tenantId: intent.tenantId,
        farmerId: intent.policyDraft.farmerId,
        productId: intent.policyDraft.productId,
        acres: intent.policyDraft.acres,
        premiumPaid: intent.amount,
        sumInsured,
      });

      // 2. Activate Policy (locks current dayIndex)
      await ctx.runMutation(internal.policies.activate, { policyId });

      // 3. Send SMS confirmation
      const farmer = await ctx.db.get(intent.policyDraft.farmerId);
      const tenant = await ctx.db.get(intent.tenantId);
      if (farmer && tenant) {
        const text = `${tenant.brandConfig.senderLabel.toUpperCase()}: Policy activated successfully! Cover: Maize Drought Index in ${product.county}. Acres: ${intent.policyDraft.acres}. Sum Insured: KES ${sumInsured.toLocaleString()}. Premium: KES ${intent.amount.toLocaleString()}. No claim form required.`;
        
        // Enqueue SMS action call (this should be triggered asynchronously or enqueued)
        // For hackathon state transparency, we'll write an SMS audit log event immediately
        await ctx.db.insert("auditLog", {
          tenantId: intent.tenantId,
          eventType: "SMS_SENT",
          actor: "system:notifier",
          entityRefs: { policyId, farmerId: farmer._id },
          snapshot: { phone: farmer.phone, message: text },
          timestamp: Date.now(),
        });
      }

      return { success: true, policyId, status: "PAID" };
    }

    return { success: false, policyId: null, status: "FAILED" };
  },
});

/**
 * Break-glass platform mutation to force-activate a policy intent.
 * Simulates a successful Safaricom Daraja STK Push callback.
 */
export const simulatePaymentSuccess = mutation({
  args: { checkoutRequestId: v.string() },
  handler: async (ctx, args) => {
    const result: {
      success: boolean;
      policyId: Id<"policies"> | null;
      status: string;
      reason?: string;
    } = await ctx.runMutation(internal.payments.confirmPayment, {
      checkoutRequestId: args.checkoutRequestId,
      resultCode: 0,
      resultDescription: "Simulated break-glass payment success",
    });
    return result;
  },
});

/**
 * Reads a payment intent by CheckoutRequestID (for front-end status checking).
 */
export const getStatus = query({
  args: { checkoutRequestId: v.string() },
  handler: async (ctx, args) => {
    const intent = await ctx.db
      .query("paymentIntents")
      .withIndex("by_checkoutRequestId", (q) =>
        q.eq("checkoutRequestId", args.checkoutRequestId)
      )
      .unique();
    return intent ? intent.status : null;
  },
});
