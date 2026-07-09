import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Sends an SMS message using the Africa's Talking API.
 * Falls back to simulation mode if environment variables are not set.
 */
export const sendSms = action({
  args: {
    phone: v.string(),
    message: v.string(),
    senderLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Read from environment variables if present
    const username = process.env.AT_USERNAME;
    const apiKey = process.env.AT_API_KEY;

    if (!username || !apiKey) {
      console.log(`[SMS SIMULATOR] To: ${args.phone} | Msg: ${args.message}`);
      return { success: true, simulated: true };
    }

    const isSandbox = username.toLowerCase() === "sandbox";
    const endpoint = isSandbox
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    const body = new URLSearchParams();
    body.append("username", username);
    body.append("to", args.phone);
    body.append("message", args.message);
    if (args.senderLabel && !isSandbox) {
      body.append("from", args.senderLabel);
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "apiKey": apiKey,
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Africa's Talking API Error: ${response.status} - ${errorText}`);
        return { success: false, error: errorText };
      }

      const responseData = await response.json();
      console.log("SMS sent successfully via Africa's Talking:", responseData);
      return { success: true, simulated: false, data: responseData };
    } catch (error) {
      console.error("Failed to connect to Africa's Talking API:", error);
      return { success: false, error: String(error) };
    }
  },
});
