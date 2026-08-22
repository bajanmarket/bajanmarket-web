/**
 * Gateway-neutral payment provider interface.
 *
 * No live provider is wired yet. Every method is defined so that a real
 * adapter (Stripe Connect, Paddle, WiPay, a local acquirer, …) can be dropped
 * in later without touching the admin UI, the database schema or the webhook
 * route. Secrets are never stored in the database — an adapter reads them from
 * server environment variables inside its own methods.
 */

export type GatewayEnvironment = "unconfigured" | "sandbox" | "live";

export type NormalizedWebhookEvent = {
  /** Stable, provider-issued event id — used for idempotency. */
  id: string;
  type:
    | "payment.authorized"
    | "payment.captured"
    | "payment.failed"
    | "payment.refunded"
    | "payout.paid"
    | "payout.failed"
    | "dispute.opened"
    | "dispute.closed"
    | "account.updated"
    | "unknown";
  /** Provider reference for the payment/payout/dispute this event concerns. */
  objectRef: string | null;
  /** Redacted payload safe to persist (no PAN, no tokens, no secrets). */
  safePayload: Record<string, unknown>;
};

export type ConnectionTestResult = {
  ok: boolean;
  message: string;
  capabilities?: Record<string, boolean>;
};

export interface PaymentGatewayAdapter {
  readonly name: string;
  readonly environment: GatewayEnvironment;
  /** Are credentials present in the server environment? */
  isConfigured(): boolean;
  /** Read-only ping used by the admin connection test. Never moves money. */
  testConnection(): Promise<ConnectionTestResult>;
  /** Verify a webhook signature against the raw request body. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<boolean>;
  /** Map a verified provider payload onto our normalized event shape. */
  parseWebhook(rawBody: string): Promise<NormalizedWebhookEvent>;
}

/**
 * Placeholder adapter used until a provider is selected. It is deliberately
 * inert: it refuses connections and rejects every webhook, so nothing can
 * accidentally mutate financial records before a real integration exists.
 */
class UnconfiguredGateway implements PaymentGatewayAdapter {
  readonly name = "unconfigured";
  readonly environment: GatewayEnvironment = "unconfigured";
  isConfigured() {
    return false;
  }
  async testConnection(): Promise<ConnectionTestResult> {
    return {
      ok: false,
      message:
        "No payment gateway is connected yet. Select a provider and add its credentials as backend secrets first.",
    };
  }
  async verifyWebhook() {
    return false;
  }
  async parseWebhook(): Promise<NormalizedWebhookEvent> {
    return { id: "", type: "unknown", objectRef: null, safePayload: {} };
  }
}

export function getGatewayAdapter(): PaymentGatewayAdapter {
  // When a provider is chosen, branch here on process.env['PAYMENT_PROVIDER'].
  return new UnconfiguredGateway();
}

/** Commission maths — integer cents only, never floats. */
export function computeSplit(input: {
  grossCents: number;
  percentageBps: number;
  fixedFeeCents: number;
  gatewayFeeCents?: number;
}) {
  const gross = Math.max(0, Math.round(input.grossCents));
  const gatewayFee = Math.max(0, Math.round(input.gatewayFeeCents ?? 0));
  const commission = Math.min(
    gross,
    Math.round((gross * Math.max(0, input.percentageBps)) / 10000) + Math.max(0, input.fixedFeeCents),
  );
  const net = Math.max(0, gross - commission - gatewayFee);
  return { grossCents: gross, gatewayFeeCents: gatewayFee, commissionCents: commission, sellerNetCents: net };
}
