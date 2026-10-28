import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  advanceHqFulfillment,
  HqLifecycleError,
  type HqLifecycleAction,
} from "../../../../workflows/hq/advance-fulfillment"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { action, certificate_url } = req.body as {
      action?: HqLifecycleAction
      certificate_url?: string
    }
    const fulfillment = await advanceHqFulfillment(req.scope, req.params.id, {
      action,
      certificate_url,
    })
    return res.json({ fulfillment })
  } catch (error) {
    if (error instanceof HqLifecycleError) {
      return res.status(error.status).json({ message: error.message })
    }
    throw error
  }
}
