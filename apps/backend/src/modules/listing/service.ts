import { MedusaService } from "@medusajs/framework/utils"
import { Listing } from "./models/listing"

export class ListingModuleService extends MedusaService({ Listing }) {
  async reviewListing(id: string, status: "LISTED" | "REJECTED", userId: string, feedback?: string) {
    return this.updateListings({ id, listing_status: status, rejection_feedback: feedback ?? null, reviewed_by: userId, reviewed_at: new Date() })
  }
}
