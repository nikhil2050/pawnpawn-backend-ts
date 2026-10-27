import { MedusaService } from "@medusajs/framework/utils"
import { Listing } from "./models/listing"

export class ListingModuleService extends MedusaService({ Listing }) {
  async reviewListing(
    id: string,
    status: "PENDING_APPROVAL" | "AVAILABLE" | "REJECTED",
    userId: string,
    feedback?: string
  ) {
    // Every moderation action records its reviewer and timestamp. An omitted
    // note preserves prior admin feedback; a supplied note becomes the latest.
    // See documentation/AI_CONTEXT.md §4.2 and §5.1.
    const changes: Record<string, unknown> = {
      id,
      listing_status: status,
      reviewed_by: userId,
      reviewed_at: new Date(),
    }

    if (status !== "REJECTED") changes.rejection_feedback = null
    if (feedback !== undefined) {
      changes.admin_feedback = feedback || null
      if (status === "REJECTED") changes.rejection_feedback = feedback || null
    }

    return this.updateListings(changes)
  }
}
