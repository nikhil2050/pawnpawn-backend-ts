import { model } from "@medusajs/framework/utils"

export const ProductLineage = model.define("product_lineage", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  seller_id: model.text().nullable(),
  buyer_id: model.text(),
  // Every ownership transfer must record its transaction value for provenance
  // and payout reconciliation.
  // See documentation/AI_CONTEXT.md §5.1 and §5.6.2.
  price: model.float(),
  transacted_at: model.dateTime(),
})
