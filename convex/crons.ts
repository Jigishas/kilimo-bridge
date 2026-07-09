import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

/**
 * Mutation that finds and deletes expired USSD sessions.
 * Limit of 100 sessions per transaction to remain clean.
 */
export const cleanExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredSessions = await ctx.db
      .query("ussdSessions")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(100);

    let deletedCount = 0;
    for (const session of expiredSessions) {
      await ctx.db.delete(session._id);
      deletedCount++;
    }

    if (deletedCount > 0) {
      console.log(`Garbage collected ${deletedCount} expired USSD sessions.`);
    }

    return deletedCount;
  },
});

const crons = cronJobs();

// Run USSD session GC every 30 minutes
crons.interval(
  "ussd session gc",
  { minutes: 30 },
  internal.crons.cleanExpiredSessions,
  {}
);

export default crons;
