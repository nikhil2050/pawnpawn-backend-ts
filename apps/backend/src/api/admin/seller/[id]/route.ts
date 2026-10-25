import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { SellerModuleService } from "../../../../modules/seller"

/**
 * GET /admin/seller/:id
 *
 * Returns a single seller by its text ID.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerService: SellerModuleService = req.scope.resolve("seller")
  const { id } = req.params

  const seller = await sellerService.retrieveSeller(id).catch(() => null)

  if (!seller) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Seller with id "${id}" was not found`
    )
  }

  res.json({ seller })
}
