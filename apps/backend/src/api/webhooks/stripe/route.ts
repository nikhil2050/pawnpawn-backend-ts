import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { StripePaymentError, constructStripeWebhookEvent } from "../../../services/stripe-payment"
import { PurchaseError, reconcileStripePaymentIntent } from "../../../workflows/purchase/dummy-checkout"

/**
 * Recovers a paid checkout when the buyer closes the browser before finalizing.
 * The middleware preserves `rawBody`; this route accepts only Stripe-signed
 * `payment_intent.succeeded` events. See documentation/AI_CONTEXT.md.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const signature = req.headers["stripe-signature"]
  const rawBody = (req as any).rawBody as Buffer | undefined
  if (typeof signature !== "string" || !rawBody) {
    return res.status(400).json({ message: "Stripe signature and raw request body are required" })
  }

  try {
    const event = constructStripeWebhookEvent(rawBody, signature)
    if (event.type !== "payment_intent.succeeded") {
      return res.status(200).json({ received: true, ignored: event.type })
    }
    const order = await reconcileStripePaymentIntent(req.scope, event.data.object)
    return res.status(200).json({ received: true, order_id: order.id })
  } catch (error) {
    if (error instanceof StripePaymentError || error instanceof PurchaseError) {
      return res.status(error.status).json({ message: error.message })
    }
    throw error
  }
}
