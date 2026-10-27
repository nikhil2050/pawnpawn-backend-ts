import { model } from "@medusajs/framework/utils"

export const ProductLineage = model.define("product_lineage", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  seller_id: model.text().nullable(),
  buyer_id: model.text(),
  // The source line is the stable idempotency key. A product can be sold to
  // the same buyer again later, so product_id + buyer_id is not sufficient.
  // See documentation/AI_CONTEXT.md §5.6.2 and §8.5.
  order_line_item_id: model.text().unique(),
  voided_at: model.dateTime().nullable(),
  voided_reason: model.text().nullable(),
  // Every ownership transfer must record its transaction value for provenance
  // and payout reconciliation.
  // See documentation/AI_CONTEXT.md §5.1 and §5.6.2.
  price: model.float(),
  transacted_at: model.dateTime(),
})
