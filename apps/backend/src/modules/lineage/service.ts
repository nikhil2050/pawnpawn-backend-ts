import { MedusaService } from "@medusajs/framework/utils"
import { ProductLineage } from "./models/product-lineage"

export class LineageModuleService extends MedusaService({
  ProductLineage,
}) {
  async recordTransfer(data: {
    product_id: string
    seller_id?: string | null
    buyer_id: string
    order_line_item_id: string
    price: number
    transacted_at?: Date
  }) {
    return this.createProductLineages({
      product_id: data.product_id,
      seller_id: data.seller_id ?? null,
      buyer_id: data.buyer_id,
      order_line_item_id: data.order_line_item_id,
      price: data.price,
      transacted_at: data.transacted_at ?? new Date(),
    })
  }

  async getLineageHistory(product_id: string) {
    return this.listProductLineages(
      { product_id },
      { order: { transacted_at: "ASC" } }
    )
  }

  async getCurrentOwner(product_id: string) {
    const [latest] = await this.listProductLineages(
      { product_id },
      { order: { transacted_at: "DESC" }, take: 1 }
    )
    return latest?.buyer_id || null
  }
}
