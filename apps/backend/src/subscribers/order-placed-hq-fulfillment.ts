import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const lockInventory = async (container: any, variantId: string) => {
  if (!variantId) return
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const inventory = container.resolve(Modules.INVENTORY) as any
  const { data: links } = await query.graph({
    entity: "product_variant_inventory_item",
    fields: ["variant_id", "inventory_item_id"],
    filters: { variant_id: [variantId] },
  })

  for (const link of links ?? []) {
    const levels = await inventory.listInventoryLevels({ inventory_item_id: link.inventory_item_id })
    if (!levels.length) continue
    await inventory.updateInventoryLevels(levels.map((level: any) => ({
      id: level.id,
      inventory_item_id: level.inventory_item_id,
      location_id: level.location_id,
      stocked_quantity: 0,
    })))
  }
}

export async function processOrderPlaced(orderId: string, container: any) {
  const orderService = container.resolve(Modules.ORDER) as any
  const order = await orderService.retrieveOrder(orderId, { relations: ["items"] })
  const listings = container.resolve("listing") as any
  const hq = container.resolve("hq_fulfillment") as any
  const lineage = container.resolve("lineage") as any
  const productService = container.resolve(Modules.PRODUCT) as any
  for (const item of order.items ?? []) {
    const [listing] = await listings.listListings({ product_id: item.product_id }, { take: 1 })
    // This subscriber also receives normal Medusa orders. Only process an
    // order line that belongs to a marketplace Listing and has a buyer.
    if (!listing || !order.customer_id) continue
    if (listing.listing_status !== "AVAILABLE" && listing.listing_status !== "SOLD") continue

    // The event may be delivered more than once. Reusing an existing Listing,
    // HQ row, or lineage row keeps checkout idempotent.
    if (listing.listing_status !== "SOLD") {
      await listings.updateListings({ id: listing.id, listing_status: "SOLD" })
      // Core Store endpoints do not know Listing state, so drafting the
      // product keeps a sold item out of both marketplace and native catalog.
      await productService.updateProducts({ id: listing.product_id, status: "draft" })
    }
    await lockInventory(container, item.variant_id)

    const [existingHq] = await hq.listHqFulfillments({ order_line_item_id: item.id }, { take: 1 })
    if (!existingHq) {
      await hq.createHqFulfillments({
        order_id: order.id,
        order_line_item_id: item.id,
        listing_id: listing.id,
        product_id: item.product_id,
        seller_id: listing.seller_id,
        buyer_id: order.customer_id,
        hq_status: "WAITING_FOR_ARRIVAL",
      })
    }

    const existingLineage = await lineage.listProductLineages(
      { order_line_item_id: item.id },
      { take: 1 }
    )
    if (!existingLineage.length) {
      await lineage.recordTransfer({
        product_id: item.product_id,
        seller_id: listing.seller_id,
        buyer_id: order.customer_id,
        order_line_item_id: item.id,
        price: Number(item.unit_price ?? 0) / 100,
      })
    }
  }
}

export default async function orderPlaced({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await processOrderPlaced(data.id, container)
}

export const config: SubscriberConfig = { event: "order.placed" }
