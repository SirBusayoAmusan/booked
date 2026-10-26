import "server-only";
import { BillingError, type BillingProvider } from "./types";
import { whopProvider } from "./whop";

// Placeholder so BILLING_PROVIDER=stripe fails loudly until it's built.
const stripeProvider: BillingProvider = {
  id: "stripe",
  async createCheckout() {
    throw new BillingError("Stripe billing isn't implemented yet.", 501);
  },
  async getManageUrl() {
    return null;
  },
  async handleWebhook() {
    return { ok: false, status: 501, message: "Stripe billing isn't implemented yet." };
  },
  async cancelOrPause() {
    throw new BillingError("Stripe billing isn't implemented yet.", 501);
  },
};

export function getBillingProvider(): BillingProvider {
  return process.env.BILLING_PROVIDER === "stripe" ? stripeProvider : whopProvider;
}

export { BillingError };
