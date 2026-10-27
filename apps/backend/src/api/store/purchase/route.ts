import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { executeDummyCheckout, PurchaseError } from "../../../workflows/purchase/dummy-checkout"

const customerIdFrom = (req: MedusaRequest) => (req as any).auth_context?.actor_id as string | undefined

/**
 * Dummy checkout for one-of-one marketplace products.
 * The order workflow creates the Medusa order; the order.placed handler then
 * performs Listing, inventory, HQ, and lineage transitions idempotently.
 * See documentation/AI_CONTEXT.md §8.5 and documentation/API.md §6.4.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = customerIdFrom(req)
  if (!customerId) return res.status(401).json({ message: "An authenticated customer is required" })

  try {
    const order = await executeDummyCheckout(req.scope, customerId, req.body as any)
    return res.status(201).json({
      order,
      payment: { status: "CAPTURED", provider: "dummy" },
      fulfillment: { status: "WAITING_FOR_ARRIVAL", per_line_item: true },
    })
  } catch (error) {
    if (error instanceof PurchaseError) {
      return res.status(error.status).json({ message: error.message })
    }
    throw error
  }
}
