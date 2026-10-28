import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  getProductMarketplaceListing,
  reassignProductMarketplaceListing,
} from "../../../../../workflows/admin/product-marketplace"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const listing = await getProductMarketplaceListing(req.scope, req.params.id)
  const product = await req.scope
    .resolve<any>(Modules.PRODUCT)
    .retrieveProduct(req.params.id, { withDeleted: true })
  res.json({ marketplace_listing: listing, archived: Boolean(product.deleted_at) })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = (req.body as { seller_id?: unknown }).seller_id
  if (typeof sellerId !== "string" || !sellerId.trim()) {
    return res.status(400).json({ message: "seller_id is required" })
  }
  const marketplaceListing = await reassignProductMarketplaceListing(
    req.scope,
    req.params.id,
    sellerId
  )
  res.json({ marketplace_listing: marketplaceListing })
}
