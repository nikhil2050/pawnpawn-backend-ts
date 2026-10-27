import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { executeHqException, HqExceptionError, type HqExceptionInput } from "../../../../../workflows/hq/handle-exception"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const adminId = (req as any).auth_context?.actor_id ?? "admin"
    const fulfillment = await executeHqException(
      req.scope,
      req.params.id,
      req.body as HqExceptionInput,
      adminId
    )
    return res.json({ fulfillment })
  } catch (error) {
    if (error instanceof HqExceptionError) {
      return res.status(error.status).json({ message: error.message })
    }
    throw error
  }
}
