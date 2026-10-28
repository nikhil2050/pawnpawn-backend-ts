import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { archiveProductMarketplaceWorkflow } from "../../../../../workflows/admin/archive-product-marketplace"

type ArchiveAction = "ARCHIVE" | "RESTORE"

/**
 * Archives and restores a Product and its custom Listing through a
 * compensating Medusa workflow. A failed counterpart operation is rolled back;
 * Listing.product_id remains the source of marketplace governance.
 * See documentation/AI_CONTEXT.md §8.11.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const action = (req.body as { action?: ArchiveAction }).action
  if (action !== "ARCHIVE" && action !== "RESTORE") {
    return res.status(400).json({ message: "action must be ARCHIVE or RESTORE" })
  }

  const { result } = await archiveProductMarketplaceWorkflow(req.scope).run({
    input: { product_id: req.params.id, action },
  })
  return res.json(result)
}
