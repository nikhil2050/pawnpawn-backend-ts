import { model } from "@medusajs/framework/utils"

export const ProductLineage = model.define("product_lineage", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  seller_id: model.text().nullable(),
  buyer_id: model.text(),
  price: model.float().nullable(),
  transacted_at: model.dateTime(),
})
