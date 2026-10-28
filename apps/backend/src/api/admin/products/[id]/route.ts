import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { refetchEntities } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { attachMarketplaceListings } from "../../../../workflows/admin/product-marketplace"
import { remapAdminProductFields, serializeAdminProduct } from "../serialization"

/** Extends Medusa's Admin product detail response with Listing-backed mapping. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { data } = await refetchEntities({
    entity: "product",
    idOrFilter: req.params.id,
    scope: req.scope,
    fields: remapAdminProductFields((req as any).queryConfig?.fields ?? []),
    withDeleted: true,
  })
  const product = data[0]
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
  }
  const [withMarketplaceListing] = await attachMarketplaceListings(req.scope, [
    serializeAdminProduct(product),
  ], { withDeleted: true })
  res.json({ product: withMarketplaceListing })
}
