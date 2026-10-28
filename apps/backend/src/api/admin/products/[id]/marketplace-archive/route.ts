import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows"

type ArchiveAction = "ARCHIVE" | "RESTORE"

/**
 * Archives and restores a Product together with its custom Listing without
 * hard deletion. Listing ownership and lineage remain queryable withDeleted.
 * See documentation/AI_CONTEXT.md §8.11.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const action = (req.body as { action?: ArchiveAction }).action
  if (action !== "ARCHIVE" && action !== "RESTORE") {
    return res.status(400).json({ message: "action must be ARCHIVE or RESTORE" })
  }

  const productService = req.scope.resolve<any>(Modules.PRODUCT)
  const listingService = req.scope.resolve<any>("listing")
  const product = await productService
    .retrieveProduct(req.params.id, { withDeleted: true })
    .catch(() => null)
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
  }

  const [listing] = await listingService.listListings(
    { product_id: product.id },
    { withDeleted: true, take: 1 }
  )

  if (action === "ARCHIVE") {
    if (!product.deleted_at) {
      await deleteProductsWorkflow(req.scope).run({ input: { ids: [product.id] } })
    }
    // Keep the UI synchronous even when the event bus processes the matching
    // product.deleted subscriber after this request completes.
    if (listing && !listing.deleted_at) {
      await listingService.deleteListings(listing.id)
    }
    return res.json({ product_id: product.id, archived: true })
  }

  if (product.deleted_at) {
    await productService.restoreProducts([product.id])
  }
  if (listing?.deleted_at) {
    await listingService.restoreListings([listing.id])
  }
  res.json({ product_id: product.id, archived: false })
}
