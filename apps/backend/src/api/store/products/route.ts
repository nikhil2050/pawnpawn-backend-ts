import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listAvailableCatalog } from "../../../workflows/storefront/catalog"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const result = await listAvailableCatalog(req.scope, req.query as any, {
    sales_channel_ids: (req as any).publishable_key_context?.sales_channel_ids,
  })
  res.json(result)
}
