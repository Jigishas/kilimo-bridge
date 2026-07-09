import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const SESSION_EXPIRY_MS = 1000 * 60 * 10; // 10 minutes

/**
 * Handles USSD menu navigation and state transitions.
 * This is called by the USSD webhook HTTP action.
 * Returns the USSD response string prefixed with "CON " (continue) or "END " (close).
 */
export const handleUssd = mutation({
  args: {
    sessionId: v.string(),
    phoneNumber: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Resolve or create USSD Session
    let session = await ctx.db
      .query("ussdSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    const now = Date.now();

    // If text is empty, it's a completely new session entry dial
    const isNewDial = args.text === "";

    if (!session || isNewDial) {
      if (session) {
        await ctx.db.delete(session._id);
      }

      const sessionId = await ctx.db.insert("ussdSessions", {
        sessionId: args.sessionId,
        phone: args.phoneNumber,
        state: "SELECT_INSURER",
        stateData: {},
        expiresAt: now + SESSION_EXPIRY_MS,
      });

      session = (await ctx.db.get(sessionId))!;
    }

    // Refresh expiry
    await ctx.db.patch(session._id, {
      expiresAt: now + SESSION_EXPIRY_MS,
    });

    // Parse latest user keystroke
    const parts = args.text.split("*");
    const lastInput = parts[parts.length - 1]?.trim() || "";

    // 2. Load farmer profile if exists (platform shared registry)
    const farmer = await ctx.db
      .query("farmers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phoneNumber))
      .unique();

    const lang = farmer?.language || "en"; // default to English

    // 3. State Machine Routing
    switch (session.state) {
      case "SELECT_INSURER": {
        if (lastInput === "1" || lastInput === "2") {
          const tenants = await ctx.db.query("tenants").collect();
          const tenant = tenants.find(
            (t) => t.slug === (lastInput === "1" ? "kilimo-sure" : "mavuno-cover")
          );

          if (!tenant) {
            return "END Insurer not found. Try again.";
          }

          // Bind tenant context
          await ctx.db.patch(session._id, {
            tenantId: tenant._id,
          });

          // Check if farmer registered
          if (farmer) {
            await ctx.db.patch(session._id, {
              state: "MAIN_MENU",
            });
            return showMainMenu(tenant.name, lang);
          } else {
            await ctx.db.patch(session._id, {
              state: "REGISTER_NAME",
            });
            return lang === "sw"
              ? `CON Karibu ${tenant.name}! Ili ujisajili, weka jina lako kamili:`
              : `CON Welcome to ${tenant.name}! To register, enter your full name:`;
          }
        }

        // Show Insurer List (Simulates dedicated shortcodes)
        const tenants = await ctx.db.query("tenants").collect();
        const option1 = tenants.find((t) => t.slug === "kilimo-sure")?.name ?? "Kilimo Sure";
        const option2 = tenants.find((t) => t.slug === "mavuno-cover")?.name ?? "Mavuno Cover";

        return `CON Select Crop Insurer:\n1. ${option1}\n2. ${option2}`;
      }

      case "REGISTER_NAME": {
        if (!lastInput) {
          return lang === "sw"
            ? "CON Jina haliwezi kuwa tupu. Weka jina lako kamili:"
            : "CON Name cannot be empty. Enter your full name:";
        }

        await ctx.db.patch(session._id, {
          state: "REGISTER_COUNTY",
          stateData: { ...session.stateData, name: lastInput },
        });

        return lang === "sw"
          ? "CON Chagua Kaunti yako:\n1. Kitui\n2. Machakos\n3. Makueni"
          : "CON Select your County:\n1. Kitui\n2. Machakos\n3. Makueni";
      }

      case "REGISTER_COUNTY": {
        let county = "";
        if (lastInput === "1") county = "Kitui";
        else if (lastInput === "2") county = "Machakos";
        else if (lastInput === "3") county = "Makueni";

        if (!county) {
          return lang === "sw"
            ? "CON Kaunti sio sahihi. Chagua:\n1. Kitui\n2. Machakos\n3. Makueni"
            : "CON Invalid choice. Select County:\n1. Kitui\n2. Machakos\n3. Makueni";
        }

        await ctx.db.patch(session._id, {
          state: "REGISTER_CONSENT",
          stateData: { ...session.stateData, county },
        });

        const consentText = lang === "sw"
          ? "Je, unakubali Mvua Shield na Mshirika wa Bima kupata data yako ya GPS/Hali ya Hewa kwa ajili ya bima?"
          : "Do you consent to sharing weather rainfall data and crop parameters for agricultural insurance index?";

        return lang === "sw"
          ? `CON Kibali cha Data:\n${consentText}\n1. Ndio (Kubali)\n2. La (Kataa)`
          : `CON Data Consent:\n${consentText}\n1. Yes (Accept)\n2. No (Decline)`;
      }

      case "REGISTER_CONSENT": {
        if (lastInput === "1") {
          // Accept Consent & Register Farmer
          const tenant = await ctx.db.get(session.tenantId!);
          const consentText = "Data sharing consent captured in USSD session";

          // Register via internal mutation helper or runMutation
          const farmerId = await ctx.runMutation(api.farmers.register, {
            phone: args.phoneNumber,
            name: session.stateData.name,
            county: session.stateData.county,
            language: lang,
            consentText,
            tenantId: session.tenantId!,
          });

          await ctx.db.patch(session._id, {
            state: "MAIN_MENU",
            stateData: { ...session.stateData, farmerId },
          });

          return showMainMenu(tenant!.name, lang);
        } else {
          // Consent Declined
          await ctx.db.patch(session._id, { state: "DONE" });
          return lang === "sw"
            ? "END Lazima ukubali masharti ili kusajiliwa. Kwaheri."
            : "END You must accept the data consent to register cover. Goodbye.";
        }
      }

      case "MAIN_MENU": {
        const tenant = await ctx.db.get(session.tenantId!);
        if (lastInput === "1") {
          // 1. Buy crop insurance - fetch products for this tenant and county
          const farmerCounty = farmer?.county ?? session.stateData.county ?? "Kitui";
          const products = await ctx.db
            .query("products")
            .withIndex("by_tenant_county", (q) =>
              q.eq("tenantId", session!.tenantId!).eq("county", farmerCounty)
            )
            .collect();

          const activeProducts = products.filter((p) => p.status === "active");

          if (activeProducts.length === 0) {
            return lang === "sw"
              ? "END Hakuna bima inayopatikana katika kaunti yako sasa hivi."
              : "END No insurance covers available in your county at this time.";
          }

          // Store list of product IDs for index matching
          const productList = activeProducts.map((p) => p._id);
          await ctx.db.patch(session._id, {
            state: "BUY_SELECT_PRODUCT",
            stateData: { ...session.stateData, productList },
          });

          let menuText = lang === "sw" ? "CON Chagua Bima ya Mazao:\n" : "CON Select Crop Cover:\n";
          activeProducts.forEach((p, idx) => {
            menuText += `${idx + 1}. ${p.name} (Premium: KES ${p.premiumPerAcre}/acre)\n`;
          });
          return menuText.trim();
        } else if (lastInput === "2") {
          // 2. View My Policies
          const policies = await ctx.db
            .query("policies")
            .withIndex("by_farmer", (q) => q.eq("farmerId", farmer!._id))
            .collect();

          const activeOrPaid = policies.filter((p) => p.tenantId === session!.tenantId && (p.status === "ACTIVE" || p.status === "PAID_OUT"));

          if (activeOrPaid.length === 0) {
            await ctx.db.patch(session._id, { state: "MAIN_MENU" });
            const backOptionText = lang === "sw" ? "0. Rudi" : "0. Back";
            return lang === "sw"
              ? `CON Huna bima zozote kwa sasa.\n${backOptionText}`
              : `CON You have no active insurance policies.\n${backOptionText}`;
          }

          let responseText = lang === "sw" ? "CON Bima Zako:\n" : "CON Your Policies:\n";
          for (let i = 0; i < activeOrPaid.length; i++) {
            const policy = activeOrPaid[i]!;
            const product = await ctx.db.get(policy.productId);
            responseText += `${i + 1}. ${product?.cropType.toUpperCase()} - ${policy.acres}Ac - ${policy.status}\n`;
          }
          responseText += lang === "sw" ? "0. Rudi" : "0. Back";

          await ctx.db.patch(session._id, {
            state: "MY_POLICIES",
          });
          return responseText.trim();
        } else if (lastInput === "3") {
          // 3. Change Language
          const newLang = lang === "en" ? "sw" : "en";
          if (farmer) {
            await ctx.db.patch(farmer._id, { language: newLang });
          }
          await ctx.db.patch(session._id, { state: "MAIN_MENU" });
          return showMainMenu(tenant!.name, newLang);
        } else {
          // Exit or invalid
          await ctx.db.patch(session._id, { state: "DONE" });
          return lang === "sw"
            ? "END Asante kwa kutembelea bima yetu. Kwaheri."
            : "END Thank you for visiting Mvua Shield partner insurance. Goodbye.";
        }
      }

      case "BUY_SELECT_PRODUCT": {
        const productList: Id<"products">[] = session.stateData.productList || [];
        const index = parseInt(lastInput) - 1;

        if (isNaN(index) || index < 0 || index >= productList.length) {
          return lang === "sw"
            ? "CON Chaguo batili. Chagua bima tena:"
            : "CON Invalid choice. Select crop cover again:";
        }

        const selectedProductId = productList[index]!;
        await ctx.db.patch(session._id, {
          state: "BUY_ENTER_ACRES",
          stateData: { ...session.stateData, productId: selectedProductId },
        });

        return lang === "sw"
          ? "CON Weka ukubwa wa shamba lako kwa ekari (mfano: 3):"
          : "CON Enter your farm size in acres (e.g. 3):";
      }

      case "BUY_ENTER_ACRES": {
        const acres = parseFloat(lastInput);
        if (isNaN(acres) || acres <= 0 || acres > 50) {
          return lang === "sw"
            ? "CON Ekari sio sahihi (Chagua kati ya 1-50). Weka tena:"
            : "CON Invalid acres (Choose between 1-50). Enter again:";
        }

        const productId = session.stateData.productId as Id<"products">;
        const product = await ctx.db.get(productId);
        if (!product) throw new Error("Product not found");

        const premium = acres * product.premiumPerAcre;
        const sumInsured = acres * product.sumInsuredPerAcre;

        await ctx.db.patch(session._id, {
          state: "BUY_CONFIRM",
          stateData: { ...session.stateData, acres, premium, sumInsured },
        });

        return lang === "sw"
          ? `CON Bima ya ${product.cropType.toUpperCase()}:\nPremium: KES ${premium.toLocaleString()}\nFidia: KES ${sumInsured.toLocaleString()}\n1. Lipa na M-Pesa (STK)\n2. Ghairi`
          : `CON ${product.cropType.toUpperCase()} Cover:\nPremium: KES ${premium.toLocaleString()}\nSum Insured: KES ${sumInsured.toLocaleString()}\n1. Pay with M-Pesa (STK)\n2. Cancel`;
      }

      case "BUY_CONFIRM": {
        if (lastInput === "1") {
          // Trigger M-Pesa STK push
          const tenant = await ctx.db.get(session.tenantId!);
          const farmerId = (farmer?._id || session.stateData.farmerId) as Id<"farmers">;
          const farmerRecord = await ctx.db.get(farmerId);
          if (!farmerRecord) throw new Error("Farmer not found");

          const productId = session.stateData.productId as Id<"products">;
          const acres = session.stateData.acres as number;

          await ctx.db.patch(session._id, { state: "DONE" });

          // Call initiate STK Push mutation asynchronously
          await ctx.runMutation(api.payments.initiate, {
            tenantId: session.tenantId!,
            farmerId: farmerRecord._id,
            productId,
            acres,
            phone: args.phoneNumber,
          });

          return lang === "sw"
            ? "END Ombi la malipo limetumwa kwa M-Pesa yako. Weka PIN kukamilisha. Cheti kitatumwa kwa SMS baada ya malipo."
            : "END An M-Pesa STK Push prompt has been sent to your phone. Enter your PIN to complete the purchase. Branded SMS certificate will follow.";
        } else {
          // Cancelled - Go back to main menu
          const tenant = await ctx.db.get(session.tenantId!);
          await ctx.db.patch(session._id, { state: "MAIN_MENU" });
          return showMainMenu(tenant!.name, lang);
        }
      }

      case "MY_POLICIES": {
        // Back to main menu
        const tenant = await ctx.db.get(session.tenantId!);
        await ctx.db.patch(session._id, { state: "MAIN_MENU" });
        return showMainMenu(tenant!.name, lang);
      }

      case "DONE":
      default: {
        return lang === "sw"
          ? "END Kikao kimeisha. Tafadhali piga tena."
          : "END Session closed. Please dial again.";
      }
    }
  },
});

function showMainMenu(brandName: string, lang: string): string {
  return lang === "sw"
    ? `CON Orodha Kuu ya ${brandName}:\n1. Nunua Bima ya Mazao\n2. Angalia Bima Zangu\n3. Badilisha Lugha (English)\n4. Ondoka`
    : `CON ${brandName} Main Menu:\n1. Buy Crop Insurance\n2. View My Policies\n3. Switch Language (Kiswahili)\n4. Exit`;
}
