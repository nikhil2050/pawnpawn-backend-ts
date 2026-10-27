import { createOrderWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { processOrderPlaced } from "../../subscribers/order-placed-hq-fulfillment"

export type PurchaseItemInput = {
  variant_id?: string
  quantity?: number
}

export type DummyCheckoutInput = {
  items?: PurchaseItemInput[]
  region_id?: string
  sales_channel_id?: string
  shipping_address?: Record<string, unknown>
}

export class PurchaseError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

const getRegionAndSalesChannel = async (container: any, input: DummyCheckoutInput) => {
  const regionService = container.resolve(Modules.REGION) as any
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL) as any
  const [region] = input.region_id
    ? await regionService.listRegions({ id: input.region_id }, { take: 1 })
    : await regionService.listRegions({}, { take: 1 })
  const [salesChannel] = input.sales_channel_id
    ? await salesChannelService.listSalesChannels({ id: input.sales_channel_id }, { take: 1 })
    : await salesChannelService.listSalesChannels({}, { take: 1 })

  if (!region) throw new PurchaseError(400, "A valid region_id is required")
  if (!salesChannel) throw new PurchaseError(400, "A valid sales_channel_id is required")
  return { region, salesChannel }
}

const validateItems = (input: DummyCheckoutInput) => {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new PurchaseError(400, "items must contain at least one variant")
  }

  const items = input.items.map((item) => ({
    variantId: item.variant_id,
    quantity: item.quantity ?? 1,
  }))
  if (items.some((item) => !item.variantId || item.quantity !== 1)) {
    throw new PurchaseError(400, "Each marketplace item must contain one variant with quantity 1")
  }
  if (new Set(items.map((item) => item.variantId)).size !== items.length) {
    throw new PurchaseError(409, "A unique listing can only be purchased once per order")
  }
  return items as Array<{ variantId: string; quantity: 1 }>
}

const priceVariants = async (container: any, variantIds: string[], currencyCode: string) => {
  const link = container.resolve(ContainerRegistrationKeys.LINK) as any
  const pricing = container.resolve(Modules.PRICING) as any
  const productPricingLink = link.getLinkModule(
    Modules.PRODUCT,
    "variant_id",
    Modules.PRICING,
    "price_set_id"
  )
  const priceLinks = await productPricingLink.list(
    { variant_id: variantIds },
    { select: ["variant_id", "price_set_id"] }
  )
  if (priceLinks.length !== variantIds.length) {
    throw new PurchaseError(400, "Each variant must have a configured price")
  }

  const calculated = await pricing.calculatePrices(
    { id: priceLinks.map((entry: any) => entry.price_set_id) },
    { context: { currency_code: currencyCode } }
  )
  const calculatedByPriceSet = new Map<string, any>((calculated as any[]).map((price) => [price.id, price]))
  const priceByVariant = new Map<string, number>()
  for (const linkEntry of priceLinks) {
    const amount = calculatedByPriceSet.get(linkEntry.price_set_id)?.calculated_amount
    if (amount == null || Number.isNaN(Number(amount))) {
      throw new PurchaseError(400, `No ${currencyCode} price is configured for variant ${linkEntry.variant_id}`)
    }
    priceByVariant.set(linkEntry.variant_id, Number(amount))
  }
  return priceByVariant
}

const assertStocked = async (container: any, variantIds: string[]) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const inventory = container.resolve(Modules.INVENTORY) as any
  const { data: links } = await query.graph({
    entity: "product_variant_inventory_item",
    fields: ["variant_id", "inventory_item_id"],
    filters: { variant_id: variantIds },
  })
  const inventoryByVariant = new Map<string, string[]>()
  for (const link of links ?? []) {
    const itemIds = inventoryByVariant.get(link.variant_id) ?? []
    itemIds.push(link.inventory_item_id)
    inventoryByVariant.set(link.variant_id, itemIds)
  }

  for (const variantId of variantIds) {
    const itemIds = inventoryByVariant.get(variantId)
    if (!itemIds?.length) {
      throw new PurchaseError(409, `Variant ${variantId} is not stocked`)
    }
    const levels = (await Promise.all(itemIds.map((id) => inventory.listInventoryLevels({ inventory_item_id: id })))).flat()
    if (!levels.some((level: any) => Number(level.stocked_quantity) > 0)) {
      throw new PurchaseError(409, `Variant ${variantId} is out of stock`)
    }
  }
}

const getListingsForVariants = async (container: any, variantIds: string[]) => {
  const productService = container.resolve(Modules.PRODUCT) as any
  const listingService = container.resolve("listing") as any
  const variants: any[] = await productService.listProductVariants(
    { id: variantIds },
    { take: variantIds.length }
  )
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]))
  if (variantsById.size !== variantIds.length) {
    const missing = variantIds.find((id) => !variantsById.has(id))
    throw new PurchaseError(404, `Variant ${missing} was not found`)
  }

  const listings = await Promise.all(variants.map(async (variant) => {
    const [listing] = await listingService.listListings(
      { product_id: variant.product_id, listing_status: "AVAILABLE" },
      { take: 1 }
    )
    return [variant.id, listing] as const
  }))
  const listingByVariant = new Map(listings)
  if ([...listingByVariant.values()].some((listing) => !listing)) {
    throw new PurchaseError(409, "One or more products are not available for purchase")
  }
  const listingIds = [...listingByVariant.values()].map((listing: any) => listing.id)
  if (new Set(listingIds).size !== listingIds.length) {
    throw new PurchaseError(409, "A unique listing can only be purchased once per order")
  }
  return { variantsById, listingByVariant }
}

/**
 * Coordinates the MVP checkout use case. The route only handles HTTP concerns;
 * this function owns marketplace validation, pricing, locking, order creation,
 * and the shared post-order lifecycle transition. See AI_CONTEXT.md §8.5.
 */
export const executeDummyCheckout = async (
  container: any,
  customerId: string,
  input: DummyCheckoutInput
) => {
  const items = validateItems(input)
  const { region, salesChannel } = await getRegionAndSalesChannel(container, input)
  const initial = await getListingsForVariants(container, items.map((item) => item.variantId))
  const locking = container.resolve(Modules.LOCKING) as any
  const lockKeys = [...initial.listingByVariant.values()]
    .map((listing: any) => `marketplace-listing:${listing.id}`)
    .sort()

  return locking.execute(lockKeys, async () => {
    // Re-read under the lock: a competing checkout may have sold the item
    // between the initial lookup and lock acquisition.
    const { variantsById } = await getListingsForVariants(
      container,
      items.map((item) => item.variantId)
    )
    await assertStocked(container, items.map((item) => item.variantId))
    const prices = await priceVariants(container, items.map((item) => item.variantId), region.currency_code)
    const orderItems = items.map((item) => {
      const variant = variantsById.get(item.variantId)
      return {
        variant_id: variant.id,
        product_id: variant.product_id,
        title: variant.title ?? "Marketplace item",
        quantity: 1,
        unit_price: prices.get(variant.id),
      }
    })

    const { result: order } = await createOrderWorkflow(container).run({
      input: {
        customer_id: customerId,
        region_id: region.id,
        sales_channel_id: salesChannel.id,
        items: orderItems,
        shipping_address: input.shipping_address,
        status: "pending",
      } as any,
    })

    await processOrderPlaced(order.id, container)
    return order
  }, { timeout: 10, expire: 60 })
}
