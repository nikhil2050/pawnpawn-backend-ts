import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

export default async function orderPlaced({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const orderService = container.resolve<any>(Modules.ORDER)
  const order = await orderService.retrieveOrder(data.id, { relations: ["items"] })
  const listings = container.resolve<any>("listing")
  const hq = container.resolve<any>("hq_fulfillment")
  const lineage = container.resolve<any>("lineage")
  for (const item of order.items ?? []) {
    const [listing] = await listings.listListings({ product_id: item.product_id, listing_status: "AVAILABLE" }, { take: 1 })
    if (!listing) continue
    await listings.updateListings({ id: listing.id, listing_status: "SOLD" })
    await hq.createHqFulfillments({ order_id: order.id, order_line_item_id: item.id, listing_id: listing.id, product_id: item.product_id, seller_id: listing.seller_id, buyer_id: order.customer_id ?? null, hq_status: "WAITING_FOR_ARRIVAL" })
    if (order.customer_id) await lineage.recordTransfer({ product_id: item.product_id, seller_id: listing.seller_id, buyer_id: order.customer_id, price: Number(item.unit_price ?? 0) / 100 })
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
