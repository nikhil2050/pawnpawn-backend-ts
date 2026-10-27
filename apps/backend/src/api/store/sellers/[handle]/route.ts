import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerService = req.scope.resolve<any>("seller")
  const seller = await sellerService.findByHandle(req.params.handle)
  if (!seller || seller.is_deactivated) return res.status(404).json({ message: "Seller not found" })
  const listingService = req.scope.resolve<any>("listing")
  const listings = await listingService.listListings({ seller_id: seller.id, listing_status: "AVAILABLE" })
  const productIds = listings.map((listing: any) => listing.product_id)
  const products = productIds.length ? await req.scope.resolve<any>(Modules.PRODUCT).listProducts({ id: productIds, status: "published" }) : []
  res.json({ seller: { id: seller.id, handle: seller.handle, store_name: seller.store_name, avatar_url: seller.avatar_url, bio: seller.bio }, products })
}
