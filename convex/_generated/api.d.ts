/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as farmers from "../farmers.js";
import type * as http from "../http.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_tenant from "../lib/tenant.js";
import type * as notifications from "../notifications.js";
import type * as payments from "../payments.js";
import type * as policies from "../policies.js";
import type * as products from "../products.js";
import type * as seed from "../seed.js";
import type * as simulation from "../simulation.js";
import type * as tenants from "../tenants.js";
import type * as trigger from "../trigger.js";
import type * as ussd from "../ussd.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  farmers: typeof farmers;
  http: typeof http;
  "lib/audit": typeof lib_audit;
  "lib/tenant": typeof lib_tenant;
  notifications: typeof notifications;
  payments: typeof payments;
  policies: typeof policies;
  products: typeof products;
  seed: typeof seed;
  simulation: typeof simulation;
  tenants: typeof tenants;
  trigger: typeof trigger;
  ussd: typeof ussd;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
