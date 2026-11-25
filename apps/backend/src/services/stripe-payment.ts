import { createHash } from "node:crypto"
import Stripe from "stripe"

export type StripePaymentInput = {
  amount: number
  currency_code: string
  customer_id: string
  region_id: string
  variant_ids: string[]
  item_fingerprint: string
  idempotency_key?: string
}

export class StripePaymentError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

export type VerifiedPayment = Pick<Stripe.PaymentIntent, "status" | "amount" | "currency" | "metadata">
export type StripeWebhookCheckout = {
  customer_id: string
  region_id: string
  variant_ids: string[]
  payment_intent_id: string
}

// A real Stripe secret is mandatory outside development. The deterministic
// development payment is only for local investor demos without a Stripe account.
export const isDemoPaymentMode = () =>
  process.env.NODE_ENV !== "production" && !process.env.STRIPE_SECRET_KEY?.trim()

export const isDemoPaymentIntent = (paymentIntentId: string) => paymentIntentId.startsWith("demo_pi_")

/**
 * Creates a stable server-side identity for the exact buyer, Region, and
 * one-of-one Variant set that an Intent is allowed to complete. See
 * documentation/AI_CONTEXT.md §8.10.
 */
export const createPaymentFingerprint = (
  customerId: string,
  regionId: string,
  variantIds: string[]
) => createHash("sha256")
  .update(JSON.stringify({ customerId, regionId, variantIds: [...variantIds].sort() }))
  .digest("hex")

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secret) {
    throw new StripePaymentError(503, "Stripe payments are not configured. Set STRIPE_SECRET_KEY on the backend.")
  }
  return new Stripe(secret)
}

const normalizedVariantIds = (variantIds: string[]) => [...variantIds].sort().join(",")

export const createStripePaymentIntent = async (input: StripePaymentInput) => {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new StripePaymentError(400, "A positive server-calculated payment amount is required")
  }
  const params: Stripe.PaymentIntentCreateParams = {
    amount: input.amount,
    currency: input.currency_code.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      pawnpawn_customer_id: input.customer_id,
      pawnpawn_region_id: input.region_id,
      pawnpawn_variant_ids: normalizedVariantIds(input.variant_ids),
      pawnpawn_item_fingerprint: input.item_fingerprint,
    },
  }
  // Stripe's idempotency key makes retries of the *intent creation* request
  // return the original Intent instead of charging twice. See AI_CONTEXT.md.
  const paymentIntent = input.idempotency_key
    ? await getStripe().paymentIntents.create(params, { idempotencyKey: input.idempotency_key })
    : await getStripe().paymentIntents.create(params)

  if (!paymentIntent.client_secret) {
    throw new StripePaymentError(502, "Stripe did not return a client secret")
  }
  return paymentIntent
}

export const createDemoPaymentIntent = (input: Omit<StripePaymentInput, "idempotency_key">): VerifiedPayment & { id: string } => ({
  id: `demo_pi_${input.item_fingerprint.slice(0, 24)}`,
  status: "succeeded",
  amount: input.amount,
  currency: input.currency_code.toLowerCase(),
  metadata: {
    pawnpawn_customer_id: input.customer_id,
    pawnpawn_region_id: input.region_id,
    pawnpawn_variant_ids: normalizedVariantIds(input.variant_ids),
    pawnpawn_item_fingerprint: input.item_fingerprint,
  },
})

export const retrieveStripePaymentIntent = async (paymentIntentId: string) => {
  if (!paymentIntentId?.startsWith("pi_")) {
    throw new StripePaymentError(400, "A valid Stripe payment_intent_id is required")
  }
  return getStripe().paymentIntents.retrieve(paymentIntentId)
}

/**
 * Stripe webhooks preserve the raw request body in the Medusa middleware so
 * Stripe can verify the signature before a disconnected browser is recovered.
 * See documentation/AI_CONTEXT.md, "Stripe PaymentIntent checkout".
 */
export const constructStripeWebhookEvent = (rawBody: Buffer | string, signature: string) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    throw new StripePaymentError(503, "Stripe webhooks are not configured. Set STRIPE_WEBHOOK_SECRET on the backend.")
  }
  try {
    return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    throw new StripePaymentError(400, "Stripe webhook signature is invalid")
  }
}

export const getStripeWebhookCheckout = (intent: Stripe.PaymentIntent): StripeWebhookCheckout => {
  const customerId = intent.metadata.pawnpawn_customer_id
  const regionId = intent.metadata.pawnpawn_region_id
  const variantIds = intent.metadata.pawnpawn_variant_ids?.split(",").filter(Boolean) ?? []
  if (!customerId || !regionId || variantIds.length === 0) {
    throw new StripePaymentError(400, "Stripe PaymentIntent is missing PawnPawn checkout metadata")
  }
  return { customer_id: customerId, region_id: regionId, variant_ids: variantIds, payment_intent_id: intent.id }
}

/**
 * Stripe is queried from the server after browser confirmation. This prevents
 * a forged client payload from finalizing a Listing or Medusa order.
 */
export const assertSucceededStripePayment = (
  intent: VerifiedPayment,
  expected: Omit<StripePaymentInput, "idempotency_key">
) => {
  if (intent.status !== "succeeded") {
    throw new StripePaymentError(409, "Stripe payment has not succeeded")
  }
  if (intent.amount !== expected.amount || intent.currency.toLowerCase() !== expected.currency_code.toLowerCase()) {
    throw new StripePaymentError(409, "Stripe payment amount or currency does not match the current server price")
  }
  if (
    intent.metadata.pawnpawn_customer_id !== expected.customer_id ||
    intent.metadata.pawnpawn_region_id !== expected.region_id ||
    intent.metadata.pawnpawn_variant_ids !== normalizedVariantIds(expected.variant_ids) ||
    intent.metadata.pawnpawn_item_fingerprint !== expected.item_fingerprint
  ) {
    throw new StripePaymentError(403, "Stripe payment does not belong to this checkout")
  }
}

/** Validates the deterministic development intent using the same invariants as Stripe. */
export const assertSucceededDemoPayment = (
  paymentIntentId: string,
  expected: Omit<StripePaymentInput, "idempotency_key">
) => {
  if (!isDemoPaymentMode() || paymentIntentId !== `demo_pi_${expected.item_fingerprint.slice(0, 24)}`) {
    throw new StripePaymentError(403, "Demo payment does not belong to this checkout")
  }
  assertSucceededStripePayment(createDemoPaymentIntent(expected), expected)
}
