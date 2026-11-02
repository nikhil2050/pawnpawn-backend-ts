import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createCheckoutPaymentIntent, PurchaseError } from "../../../workflows/purchase/dummy-checkout"

const customerIdFrom = (req: MedusaRequest) => (req as any).auth_context?.actor_id as string | undefined

/**
 * Creates the Stripe PaymentIntent only after Medusa Pricing calculates the
 * active-region total. This route never creates an order or changes inventory.
 * See documentation/AI_CONTEXT.md, "Stripe PaymentIntent checkout".
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = customerIdFrom(req)
  if (!customerId) return res.status(401).json({ message: "An authenticated customer is required" })

  try {
    const payment = await createCheckoutPaymentIntent(req.scope, customerId, req.body as any)
    return res.status(201).json({ payment })
  } catch (error) {
    if (error instanceof PurchaseError) {
      return res.status(error.status).json({ message: error.message })
    }
    throw error
  }
}
