import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { executeStripeCheckout, PurchaseError } from "../../../workflows/purchase/dummy-checkout"

const customerIdFrom = (req: MedusaRequest) => (req as any).auth_context?.actor_id as string | undefined

/**
 * Finalizes a confirmed Stripe PaymentIntent for one-of-one marketplace items.
 * Server-side Stripe verification precedes order, Listing, inventory, HQ, and
 * lineage changes. See documentation/AI_CONTEXT.md, "Stripe PaymentIntent checkout".
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = customerIdFrom(req)
  if (!customerId) return res.status(401).json({ message: "An authenticated customer is required" })

  try {
    const order = await executeStripeCheckout(req.scope, customerId, req.body as any)
    return res.status(201).json({
      order,
      payment: { status: "CAPTURED", provider: "stripe", payment_intent_id: (req.body as any).payment_intent_id },
      fulfillment: { status: "WAITING_FOR_ARRIVAL", per_line_item: true },
    })
  } catch (error) {
    if (error instanceof PurchaseError) {
      return res.status(error.status).json({ message: error.message })
    }
    throw error
  }
}
