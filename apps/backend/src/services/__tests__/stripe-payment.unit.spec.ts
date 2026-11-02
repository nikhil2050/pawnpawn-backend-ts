import {
  assertSucceededStripePayment,
  assertSucceededDemoPayment,
  createDemoPaymentIntent,
  createPaymentFingerprint,
  isDemoPaymentMode,
  StripePaymentError,
} from "../stripe-payment"

const expected = {
  amount: 125000,
  currency_code: "eur",
  customer_id: "cus_buyer",
  region_id: "reg_eu_native",
  item_fingerprint: createPaymentFingerprint("cus_buyer", "reg_eu_native", ["variant_b", "variant_a"]),
}

const succeededIntent = {
  status: "succeeded" as const,
  amount: expected.amount,
  currency: expected.currency_code,
  metadata: {
    pawnpawn_customer_id: expected.customer_id,
    pawnpawn_region_id: expected.region_id,
    pawnpawn_item_fingerprint: expected.item_fingerprint,
  },
}

describe("Stripe PaymentIntent reconciliation", () => {
  it("uses a stable fingerprint regardless of cart item order", () => {
    expect(createPaymentFingerprint("cus_buyer", "reg_eu_native", ["variant_a", "variant_b"]))
      .toBe(expected.item_fingerprint)
  })

  it("accepts only a succeeded Intent for the exact customer, Region, items, amount, and currency", () => {
    expect(() => assertSucceededStripePayment(succeededIntent, expected)).not.toThrow()
  })

  it("rejects a forged or incomplete payment before order fulfillment", () => {
    expect(() => assertSucceededStripePayment({ ...succeededIntent, status: "processing" }, expected))
      .toThrow(StripePaymentError)
    expect(() => assertSucceededStripePayment({
      ...succeededIntent,
      metadata: { ...succeededIntent.metadata, pawnpawn_region_id: "reg_in_native" },
    }, expected)).toThrow("does not belong to this checkout")
    expect(() => assertSucceededStripePayment({ ...succeededIntent, amount: 1 }, expected))
      .toThrow("amount or currency does not match")
  })

  it("permits only the deterministic development demo payment when Stripe is unset", () => {
    const priorSecret = process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_SECRET_KEY
    expect(isDemoPaymentMode()).toBe(true)
    const intent = createDemoPaymentIntent(expected)
    expect(intent.id).toMatch(/^demo_pi_/)
    expect(() => assertSucceededDemoPayment(intent.id, expected)).not.toThrow()
    expect(() => assertSucceededDemoPayment("demo_pi_forged", expected)).toThrow(StripePaymentError)
    if (priorSecret) process.env.STRIPE_SECRET_KEY = priorSecret
  })
})
