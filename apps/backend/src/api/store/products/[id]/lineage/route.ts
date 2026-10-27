import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getPublicLineage } from "../../../../../workflows/storefront/lineage"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const result = await getPublicLineage(req.scope, req.params.id)
  res.json(result)
}
