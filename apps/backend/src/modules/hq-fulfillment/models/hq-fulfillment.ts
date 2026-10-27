import { model } from "@medusajs/framework/utils"

export const HqFulfillment = model.define("hq_fulfillment", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  order_line_item_id: model.text().unique(),
  listing_id: model.text(),
  product_id: model.text(),
  seller_id: model.text(),
  buyer_id: model.text().nullable(),
  hq_status: model.enum(["WAITING_FOR_ARRIVAL", "ARRIVED_AT_HQ", "AUTHENTICATED_AND_PACKED", "DISPATCHED", "DELIVERED", "CANCELLED_BY_SELLER"]).default("WAITING_FOR_ARRIVAL"),
  certificate_url: model.text().nullable(),
  payout_released_at: model.dateTime().nullable(),
  refund_amount: model.float().nullable(),
  refund_status: model.enum(["NOT_REQUIRED", "PENDING", "REFUNDED", "SKIPPED_DUMMY", "FAILED"]).default("NOT_REQUIRED"),
  exception_reason: model.text().nullable(),
  exception_by: model.text().nullable(),
  exception_at: model.dateTime().nullable(),
})
