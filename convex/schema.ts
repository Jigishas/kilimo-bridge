import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Reusable validators
// ---------------------------------------------------------------------------

/**
 * A single phase of a parametric trigger rule.
 * Days are indices into the simulated season clock (see simulation.ts),
 * NOT wall-clock dates — this is what makes the 72-hour demo drivable.
 */
const triggerPhase = v.object({
  name: v.string(),            // "Germination" | "Flowering" (display only)
  startDay: v.number(),        // inclusive season-day the phase opens
  endDay: v.number(),          // inclusive season-day the phase closes
  thresholdMm: v.number(),     // cumulative rainfall floor for the phase
  payoutPct: v.number(),       // 0–1 fraction of sum insured paid on breach
});

export default defineSchema({
  // -------------------------------------------------------------------------
  // TENANCY ROOT
  // -------------------------------------------------------------------------

  /**
   * One row per insurer sharing this deployment.
   * Everything tenant-scoped hangs off tenants._id.
   */
  tenants: defineTable({
    name: v.string(),                       // "Kilimo Sure", "Mavuno Cover"
    slug: v.string(),                       // "kilimo-sure" — stable key for seeds/URLs
    brandConfig: v.object({
      senderLabel: v.string(),              // SMS sender label shown to farmers
      primaryColor: v.string(),             // hex, injected into dashboard theme
      logoUrl: v.optional(v.string()),
      ussdDisplayName: v.string(),          // name shown in the USSD insurer menu
    }),
    status: v.union(v.literal("active"), v.literal("suspended")),
  }).index("by_slug", ["slug"]),

  /**
   * Dashboard operators. tenantId === undefined ⇒ platform admin —
   * the ONLY identity class that may cross tenant boundaries,
   * and only via the explicit asPlatformAdmin() helper.
   */
  users: defineTable({
    tenantId: v.optional(v.id("tenants")),  // undefined = platform admin
    role: v.union(v.literal("tenant_admin"), v.literal("platform_admin")),
    authSubject: v.string(),                // Convex Auth identity subject
    name: v.string(),
    email: v.string(),
  })
    .index("by_authSubject", ["authSubject"])
    .index("by_tenant", ["tenantId"]),

  // -------------------------------------------------------------------------
  // TENANT-SCOPED CATALOG & BOOK OF BUSINESS
  // -------------------------------------------------------------------------

  /**
   * Insurance products. Each tenant defines its own products with its own
   * pricing and trigger rules — the same county can be covered by both
   * insurers with different thresholds, which is exactly what the
   * tenancy-proof demo shows.
   */
  products: defineTable({
    tenantId: v.id("tenants"),              // TENANT-SCOPED
    name: v.string(),                       // "Maize Drought Cover — Machakos"
    county: v.string(),                     // join key to weatherReadings
    cropType: v.string(),                   // "maize" (display/underwriting)
    premiumPerAcre: v.number(),             // KES
    sumInsuredPerAcre: v.number(),          // KES
    triggerRule: v.object({
      phases: v.array(triggerPhase),        // hackathon scope: 2 phases
    }),
    status: v.union(v.literal("active"), v.literal("retired")),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_county", ["tenantId", "county"])
    .index("by_county_status", ["county", "status"]), // fireTriggers pass (asPlatformAdmin only)

  /**
   * A farmer's cover instance. The core tenant-scoped record —
   * every dashboard number is an aggregate over this table.
   */
  policies: defineTable({
    tenantId: v.id("tenants"),              // TENANT-SCOPED
    farmerId: v.id("farmers"),
    productId: v.id("products"),
    acres: v.number(),
    premiumPaid: v.number(),                // KES actually collected
    sumInsured: v.number(),                 // frozen at purchase: acres × sumInsuredPerAcre
    status: v.union(
      v.literal("PENDING_PAYMENT"),         // created, STK push in flight
      v.literal("ACTIVE"),                  // payment confirmed, cover live
      v.literal("PAID_OUT"),                // trigger fired, payout recorded
      v.literal("LAPSED"),                  // payment never confirmed (GC'd)
    ),
    purchaseDay: v.number(),                // season-day index at activation
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"])
    .index("by_tenant_farmer", ["tenantId", "farmerId"])
    .index("by_farmer", ["farmerId"]),      // USSD "My Policies" (farmer-owned view)

  /**
   * One row per M-Pesa STK push attempt. The idempotency anchor for the
   * whole payment flow: the Daraja callback is matched on
   * checkoutRequestId, and a duplicate callback finds status already
   * "PAID" and exits without side effects.
   */
  paymentIntents: defineTable({
    tenantId: v.id("tenants"),              // TENANT-SCOPED
    checkoutRequestId: v.string(),          // UNIQUE via by_checkoutRequestId
    phone: v.string(),
    amount: v.number(),
    policyDraft: v.object({                 // everything needed to mint the policy on PAID
      farmerId: v.id("farmers"),
      productId: v.id("products"),
      acres: v.number(),
    }),
    status: v.union(
      v.literal("PENDING"),
      v.literal("PAID"),
      v.literal("FAILED"),
      v.literal("TIMED_OUT"),
    ),
    resultDescription: v.optional(v.string()), // raw Daraja result for debugging
  })
    .index("by_checkoutRequestId", ["checkoutRequestId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  /**
   * The money-out ledger. triggerSnapshot freezes the evidence —
   * rainfall observed, threshold breached, phase — so the payout is
   * self-explaining forever, independent of later product edits.
   */
  payouts: defineTable({
    tenantId: v.id("tenants"),              // TENANT-SCOPED
    policyId: v.id("policies"),
    amount: v.number(),                     // KES
    status: v.literal("SENT"),              // hackathon scope: B2C is simulated
    triggerSnapshot: v.object({
      phaseName: v.string(),
      dayIndex: v.number(),
      cumulativeMm: v.number(),
      thresholdMm: v.number(),
      payoutPct: v.number(),
    }),
    smsMessageId: v.optional(v.string()),   // Africa's Talking delivery ref
  })
    .index("by_tenant", ["tenantId"])
    .index("by_policy", ["policyId"]),      // also the idempotency guard: one payout per policy+phase

  /**
   * Append-only audit spine. Written in the SAME Convex mutation as the
   * state change it describes — Convex mutations are transactional, so an
   * audit row can never exist without its event, nor vice versa.
   */
  auditLog: defineTable({
    tenantId: v.id("tenants"),              // TENANT-SCOPED
    eventType: v.union(
      v.literal("FARMER_REGISTERED"),
      v.literal("CONSENT_CAPTURED"),
      v.literal("PAYMENT_INITIATED"),
      v.literal("PAYMENT_CONFIRMED"),
      v.literal("POLICY_ACTIVATED"),
      v.literal("TRIGGER_EVALUATED"),
      v.literal("TRIGGER_FIRED"),
      v.literal("PAYOUT_SENT"),
      v.literal("SMS_SENT"),
    ),
    actor: v.string(),                      // "farmer:+2547...", "system:cron", "user:<id>"
    entityRefs: v.object({                  // loose refs, all optional — one shape for all events
      policyId: v.optional(v.id("policies")),
      farmerId: v.optional(v.id("farmers")),
      payoutId: v.optional(v.id("payouts")),
      paymentIntentId: v.optional(v.id("paymentIntents")),
    }),
    snapshot: v.any(),                      // event-specific evidence blob
    timestamp: v.number(),
  })
    .index("by_tenant_time", ["tenantId", "timestamp"])
    .index("by_tenant_type", ["tenantId", "eventType"]),

  // -------------------------------------------------------------------------
  // PLATFORM-SCOPED (deliberately shared — see §1 rule 2)
  // -------------------------------------------------------------------------

  /**
   * ONE farmer registry for the whole platform. NO tenantId — a farmer
   * is a person, not an insurer's property. Tenancy attaches at the
   * policy, never at the person.
   */
  farmers: defineTable({
    phone: v.string(),                      // UNIQUE via by_phone; E.164
    name: v.string(),
    county: v.string(),
    language: v.union(v.literal("en"), v.literal("sw")),
    consentRecord: v.object({
      text: v.string(),                     // exact consent copy shown on USSD
      acceptedAt: v.number(),
    }),
  })
    .index("by_phone", ["phone"]),

  /**
   * ONE weather truth for the whole platform. NO tenantId — every
   * tenant's triggers evaluate against the same reading for a county.
   * Written only by simulation.ts (hackathon) / ingestion action (prod).
   */
  weatherReadings: defineTable({
    county: v.string(),
    dayIndex: v.number(),                   // simulated season-day
    rainfallMm: v.number(),                 // that day's rainfall
    cumulativeMm: v.number(),               // running season total (precomputed for O(1) trigger reads)
  })
    .index("by_county_day", ["county", "dayIndex"]),

  // -------------------------------------------------------------------------
  // EPHEMERAL
  // -------------------------------------------------------------------------

  /**
   * USSD session state machine. tenantId is OPTIONAL because a session
   * starts tenant-less at the insurer-selection menu and becomes
   * tenant-bound the moment the farmer picks an insurer — the earliest
   * possible point tenancy can attach. Garbage-collected by cron.
   */
  ussdSessions: defineTable({
    sessionId: v.string(),                  // Africa's Talking session id, UNIQUE via by_sessionId
    phone: v.string(),
    tenantId: v.optional(v.id("tenants")),  // bound at menu level 1
    state: v.union(
      v.literal("SELECT_INSURER"),
      v.literal("MAIN_MENU"),
      v.literal("REGISTER_NAME"),
      v.literal("REGISTER_COUNTY"),
      v.literal("REGISTER_CONSENT"),
      v.literal("BUY_SELECT_PRODUCT"),
      v.literal("BUY_ENTER_ACRES"),
      v.literal("BUY_CONFIRM"),
      v.literal("AWAITING_PAYMENT"),
      v.literal("MY_POLICIES"),
      v.literal("DONE"),
    ),
    stateData: v.any(),                     // per-state scratch (selected product, acres, …)
    expiresAt: v.number(),                  // cron GC watermark
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_expiresAt", ["expiresAt"]),  // cheap range scan for the GC cron

  /**
   * Single-row season clock for the demo. The platform admin's
   * "Advance Day" button increments dayIndex; everything downstream
   * (weather writes, trigger evaluation) keys off it.
   */
  simulationState: defineTable({
    dayIndex: v.number(),
    scenarioName: v.string(),               // "drought-machakos" etc.
  }),
});
