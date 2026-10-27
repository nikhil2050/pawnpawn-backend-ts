import { MedusaService } from "@medusajs/framework/utils"
import { Listing } from "./models/listing"

export class ListingModuleService extends MedusaService({ Listing }) {
  async reviewListing(id: string, status: "LISTED" | "REJECTED", userId: string, feedback?: string) {
    // Write reviewer identity and feedback together with the state transition
    // so every admin decision remains auditable.
    // See documentation/AI_CONTEXT.md §5.1 and §5.4.
    return this.updateListings({
      id,
      listing_status: status,
      rejection_feedback: feedback ?? null,
      admin_feedback: feedback ?? null,
      reviewed_by: userId,
      reviewed_at: new Date(),
    })
  }
}
