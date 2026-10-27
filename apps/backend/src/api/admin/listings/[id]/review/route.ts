import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { action, feedback, corrections } = req.body as any
  if (action !== "APPROVE" && action !== "RETURN") return res.status(400).json({ message: "action must be APPROVE or RETURN" })
  const listingService = req.scope.resolve<any>("listing")
  const listing = await listingService.retrieveListing(req.params.id)
  const reviewer = (req as any).auth_context?.actor_id ?? "admin"
  if (action === "RETURN") return res.json({ listing: await listingService.reviewListing(listing.id, "REJECTED", reviewer, feedback) })
  if (corrections) await req.scope.resolve<any>(Modules.PRODUCT).updateProducts({ id: listing.product_id, ...corrections })
  const reviewed = await listingService.reviewListing(listing.id, "LISTED", reviewer)
  await req.scope.resolve<any>(Modules.PRODUCT).updateProducts({ id: listing.product_id, status: "published" })
  res.json({ listing: reviewed })
}
