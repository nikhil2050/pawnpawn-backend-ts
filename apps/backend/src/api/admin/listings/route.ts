import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const listings = await req.scope.resolve<any>("listing").listListings({})
  const sellers = await req.scope.resolve<any>("seller").listSellers({})
  const sellerById = new Map(sellers.map((seller: any) => [seller.id, seller]))
  const productIds = listings.map((listing: any) => listing.product_id)
  const products = productIds.length ? await req.scope.resolve<any>(Modules.PRODUCT).listProducts({ id: productIds }) : []
  const productById = new Map(products.map((product: any) => [product.id, product]))
  res.json({ listings: listings.map((listing: any) => ({ ...listing, seller: sellerById.get(listing.seller_id), product: productById.get(listing.product_id) })) })
}
