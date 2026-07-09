import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

/**
 * HTTP route for Africa's Talking USSD webhook.
 * Expects application/x-www-form-urlencoded parameters:
 * sessionId, serviceCode, phoneNumber, text
 * Returns text/plain USSD response (prefixed with CON or END).
 */
http.route({
  path: "/webhooks/ussd",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const bodyText = await req.text();
      const params = new URLSearchParams(bodyText);

      const sessionId = params.get("sessionId");
      const phoneNumber = params.get("phoneNumber");
      const text = params.get("text") ?? "";

      if (!sessionId || !phoneNumber) {
        return new Response("Missing USSD parameters (sessionId, phoneNumber)", {
          status: 400,
          headers: { "Content-Type": "text/plain" },
        });
      }

      // Execute USSD state machine
      const ussdResponse: string = await ctx.runMutation(api.ussd.handleUssd, {
        sessionId,
        phoneNumber,
        text,
      });

      return new Response(ussdResponse, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    } catch (error) {
      console.error("USSD webhook handler failed:", error);
      return new Response(`END System error. Please try again.`, {
        status: 200, // Return standard USSD error format
        headers: { "Content-Type": "text/plain" },
      });
    }
  }),
});

/**
 * HTTP route for Safaricom Daraja M-Pesa STK push callback.
 * Expects JSON payload.
 * Returns confirmation back to Safaricom.
 */
http.route({
  path: "/webhooks/mpesa/stk-callback",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const payload = await req.json();
      console.log("Received Safaricom STK Push callback payload:", JSON.stringify(payload));

      const stkCallback = payload?.Body?.stkCallback;
      if (!stkCallback) {
        return new Response("Invalid payload body structure", { status: 400 });
      }

      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const resultCode = stkCallback.ResultCode;
      const resultDescription = stkCallback.ResultDesc || "No description provided";

      if (!checkoutRequestId) {
        return new Response("Missing CheckoutRequestID", { status: 400 });
      }

      // Process payment confirmation inside mutation transaction
      await ctx.runMutation(internal.payments.confirmPayment, {
        checkoutRequestId,
        resultCode,
        resultDescription,
      });

      // Safaricom expects a success code in response
      return new Response(
        JSON.stringify({
          ResponseCode: "0",
          ResponseDesc: "Success",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("M-Pesa STK callback handler failed:", error);
      return new Response(
        JSON.stringify({
          ResponseCode: "1",
          ResponseDesc: "Internal Error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

authComponent.registerRoutes(http, createAuth);

export default http;
