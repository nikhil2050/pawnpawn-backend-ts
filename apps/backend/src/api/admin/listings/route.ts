import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

const listingStatuses = new Set([
  "PENDING_APPROVAL",
  "AVAILABLE",
  "SOLD",
  "REJECTED",
])

const stringQueryValue = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const status = stringQueryValue((req.query as any).status ?? (req.query as any).listing_status)
  const sellerId = stringQueryValue((req.query as any).seller_id)

  if (status && !listingStatuses.has(status)) {
    return res.status(400).json({
      message: "status must be PENDING_APPROVAL, AVAILABLE, SOLD, or REJECTED",
    })
  }

  const filters: Record<string, string> = {}
  if (status) filters.listing_status = status
  if (sellerId) filters.seller_id = sellerId

  const listings = await req.scope.resolve<any>("listing").listListings(filters)
  const sellers = await req.scope.resolve<any>("seller").listSellers({})
  const sellerById = new Map(sellers.map((seller: any) => [seller.id, seller]))
  const productIds = listings.map((listing: any) => listing.product_id)
  const products = productIds.length ? await req.scope.resolve<any>(Modules.PRODUCT).listProducts({ id: productIds }) : []
  const productById = new Map(products.map((product: any) => [product.id, product]))
  res.json({
    listings: listings.map((listing: any) => ({
      ...listing,
      seller: sellerById.get(listing.seller_id),
      product: productById.get(listing.product_id),
    })),
  })
}
