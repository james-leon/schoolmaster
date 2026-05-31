// Subscription activation service.
// Today: manual activation by super admin via the super-admin API.
// Tomorrow: this is also where an automatic checkout (CinetPay/Stripe)
// callback would land and call `activateSubscription` after verifying
// the payment.

import { superAdminApi } from "./super-admin-api";
import type { PlanId } from "./plans";
import type { SubscriptionStatus } from "./usePlan";

export interface ActivateSubscriptionInput {
  schoolId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  subscriptionStart?: string;
  subscriptionEnd?: string;
  trialEnd?: string;
}

export const subscriptionService = {
  /** Manual or future automatic activation. */
  async activate(input: ActivateSubscriptionInput) {
    return superAdminApi.updateSubscription(input);
  },

  /**
   * Placeholder for future checkout. For now returns an instruction to
   * contact Wintek; later this will redirect to a payment gateway.
   */
  async startCheckout(_schoolId: string, _plan: PlanId): Promise<{ kind: "manual" }> {
    return { kind: "manual" };
  },
};
