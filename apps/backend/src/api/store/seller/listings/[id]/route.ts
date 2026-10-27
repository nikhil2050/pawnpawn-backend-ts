import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const sellerService = req.scope.resolve<any>("seller")
  const [seller] = await sellerService.listSellers({ customer_id: (req as any).auth_context?.actor_id, is_deactivated: false }, { take: 1 })
  if (!seller) return res.status(403).json({ message: "An active seller profile is required" })
  const listingService = req.scope.resolve<any>("listing")
  const listing = await listingService.retrieveListing(req.params.id)
  if (listing.seller_id !== seller.id) return res.status(403).json({ message: "You can only edit your own listings" })
  if (listing.listing_status === "SOLD") return res.status(409).json({ message: "Sold listings cannot be edited" })
  const body = req.body as any
  if (body.title || body.description || body.handle) await req.scope.resolve<any>(Modules.PRODUCT).updateProducts({ id: listing.product_id, title: body.title, description: body.description, handle: body.handle })
  const updated = await listingService.updateListings({ id: listing.id, item_condition: body.condition ?? listing.item_condition, listing_type: body.listing_type ?? listing.listing_type, listing_status: "PENDING_APPROVAL", rejection_feedback: null, reviewed_by: null, reviewed_at: null })
  res.json({ listing: updated })
}
