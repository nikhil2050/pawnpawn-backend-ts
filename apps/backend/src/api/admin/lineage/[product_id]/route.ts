import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminProductLineage } from "../../../../workflows/admin/lineage"

/** Read-only administrator provenance view for authentication and disputes. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const result = await getAdminProductLineage(req.scope, req.params.product_id)
  res.json(result)
}
