import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const transitions: Record<string, string> = {
  MARK_RECEIVED: "ARRIVED_AT_HQ",
  AUTHENTICATE_AND_PACK: "AUTHENTICATED_AND_PACKED",
  DISPATCH: "DISPATCHED",
  MARK_DELIVERED: "DELIVERED",
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { action, certificate_url } = req.body as { action?: string; certificate_url?: string }
  const hqStatus = action ? transitions[action] : undefined
  if (!hqStatus) return res.status(400).json({ message: "Unsupported HQ fulfillment action" })
  const hq = req.scope.resolve<any>("hq_fulfillment")
  const changes: Record<string, unknown> = { id: req.params.id, hq_status: hqStatus }
  if (certificate_url) changes.certificate_url = certificate_url
  if (hqStatus === "DELIVERED") changes.payout_released_at = new Date()
  res.json({ fulfillment: await hq.updateHqFulfillments(changes) })
}
