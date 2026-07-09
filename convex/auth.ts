import { betterAuth } from "better-auth";
import { createClient, type GenericCtx, type AuthFunctions } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, user) => {
        // Match user by email to associate with seeded profiles
        const existing = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("email"), user.email))
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, {
            authSubject: user._id, // map custom auth ID
            name: user.name || existing.name,
          });
          console.log(`Synced authenticated identity ${user._id} for user ${user.email}`);
        } else {
          await ctx.db.insert("users", {
            email: user.email,
            name: user.name || "User",
            role: "tenant_admin",
            authSubject: user._id,
          });
          console.log(`Created new app-level user for ${user.email}`);
        }
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: process.env.SITE_URL,
    database: authComponent.adapter(ctx),
    plugins: [
      convex({ authConfig }),
    ],
    emailAndPassword: {
      enabled: true,
    },
  });
};
