import { model } from "@medusajs/framework/utils"

export const Listing = model.define("listing", {
  id: model.id().primaryKey(),
  seller_id: model.text(),
  product_id: model.text().unique(),
  listing_status: model.enum(["PENDING_APPROVAL", "LISTED", "SOLD", "REJECTED"]).default("PENDING_APPROVAL"),
  listing_type: model.enum(["FIXED_PRICE", "AUCTION"]).default("FIXED_PRICE"),
  item_condition: model.text().nullable(),
  rejection_feedback: model.text().nullable(),
  reviewed_by: model.text().nullable(),
  reviewed_at: model.dateTime().nullable(),
})
