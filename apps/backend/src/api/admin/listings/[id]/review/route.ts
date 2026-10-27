import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Keep review decisions explicit so approval, correction, and rejection are
  // represented by the Listing lifecycle rather than by raw product updates.
  // See documentation/AI_CONTEXT.md §5.1, §5.4, and §10.3.
  const { action, feedback, corrections, edited_data } = req.body as any
  if (!["APPROVE", "EDIT_AND_APPROVE", "REJECT", "RETURN"].includes(action)) {
    return res.status(400).json({ message: "action must be APPROVE, EDIT_AND_APPROVE, or REJECT" })
  }
  const listingService = req.scope.resolve<any>("listing")
  const listing = await listingService.retrieveListing(req.params.id)
  const reviewer = (req as any).auth_context?.actor_id ?? "admin"
  if (action === "RETURN" || action === "REJECT") {
    return res.json({ listing: await listingService.reviewListing(listing.id, "REJECTED", reviewer, feedback) })
  }
  const edits = edited_data ?? corrections
  if (action === "EDIT_AND_APPROVE" && !edits) {
    return res.status(400).json({ message: "edited_data is required for EDIT_AND_APPROVE" })
  }
  if (edits) await req.scope.resolve<any>(Modules.PRODUCT).updateProducts({ id: listing.product_id, ...edits })
  const reviewed = await listingService.reviewListing(listing.id, "LISTED", reviewer)
  await req.scope.resolve<any>(Modules.PRODUCT).updateProducts({ id: listing.product_id, status: "published" })
  res.json({ listing: reviewed })
}
