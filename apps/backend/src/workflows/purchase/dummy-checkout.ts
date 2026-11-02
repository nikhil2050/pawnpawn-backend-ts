import { createOrderWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { processOrderPlaced } from "../../subscribers/order-placed-hq-fulfillment"
import { RegionalContextError, resolveRegionalContext } from "../../utils/regional-context"
import { calculateRegionalVariantPrices } from "../../utils/regional-pricing"
import {
  assertSucceededStripePayment,
  assertSucceededDemoPayment,
  createDemoPaymentIntent,
  createPaymentFingerprint,
  createStripePaymentIntent,
  isDemoPaymentIntent,
  isDemoPaymentMode,
  retrieveStripePaymentIntent,
  StripePaymentError,
} from "../../services/stripe-payment"

export type PurchaseItemInput = {
  variant_id?: string
  quantity?: number
}

export type DummyCheckoutInput = {
  items?: PurchaseItemInput[]
  region_id?: string
  currency_code?: string
  sales_channel_id?: string
  shipping_address?: Record<string, unknown>
  payment_intent_id?: string
  idempotency_key?: string
}

export class PurchaseError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

const getRegionAndSalesChannel = async (container: any, input: DummyCheckoutInput) => {
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL) as any
  let region
  try {
    region = await resolveRegionalContext(container, input)
  } catch (error) {
    if (error instanceof RegionalContextError) throw new PurchaseError(error.status, error.message)
    throw error
  }
  const [salesChannel] = input.sales_channel_id
    ? await salesChannelService.listSalesChannels({ id: input.sales_channel_id }, { take: 1 })
    : await salesChannelService.listSalesChannels({}, { take: 1 })

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

const priceVariants = async (container: any, variantIds: string[], region: { id: string; currency_code: string }) => {
  const prices = await calculateRegionalVariantPrices(container, variantIds, region)
  const priceByVariant = new Map<string, number>()
  for (const variantId of variantIds) {
    const amount = prices.get(variantId)?.calculated_amount
    if (amount == null || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new PurchaseError(400, `No non-zero ${region.currency_code} price is configured for variant ${variantId}`)
    }
    priceByVariant.set(variantId, Number(amount))
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

export type CheckoutQuote = {
  items: Array<{ variantId: string; quantity: 1 }>
  region: { id: string; currency_code: string }
  salesChannel: { id: string }
  variantsById: Map<string, any>
  prices: Map<string, number>
  total: number
  itemFingerprint: string
}

/**
 * Calculates the only amount Stripe may receive. It is shared by Intent
 * creation and final order placement so browser prices are never trusted.
 * See documentation/AI_CONTEXT.md, "Stripe PaymentIntent checkout".
 */
export const getCheckoutQuote = async (
  container: any,
  customerId: string,
  input: DummyCheckoutInput
): Promise<CheckoutQuote> => {
  const items = validateItems(input)
  const { region, salesChannel } = await getRegionAndSalesChannel(container, input)
  const { variantsById } = await getListingsForVariants(container, items.map((item) => item.variantId))
  await assertStocked(container, items.map((item) => item.variantId))
  const prices = await priceVariants(container, items.map((item) => item.variantId), region)
  const total = items.reduce((sum, item) => sum + (prices.get(item.variantId) ?? 0), 0)
  if (!Number.isInteger(total) || total <= 0) {
    throw new PurchaseError(400, "A positive regional total is required")
  }
  return {
    items,
    region,
    salesChannel,
    variantsById,
    prices,
    total,
    itemFingerprint: createPaymentFingerprint(customerId, region.id, items.map((item) => item.variantId)),
  }
}

export const createCheckoutPaymentIntent = async (
  container: any,
  customerId: string,
  input: DummyCheckoutInput
) => {
  const quote = await getCheckoutQuote(container, customerId, input)
  const paymentInput = {
    amount: quote.total,
    currency_code: quote.region.currency_code,
    customer_id: customerId,
    region_id: quote.region.id,
    item_fingerprint: quote.itemFingerprint,
  }
  if (isDemoPaymentMode()) {
    const intent = createDemoPaymentIntent(paymentInput)
    return {
      payment_intent_id: intent.id,
      amount: quote.total,
      currency_code: quote.region.currency_code,
      provider: "demo" as const,
    }
  }
  try {
    const intent = await createStripePaymentIntent({
      ...paymentInput,
      idempotency_key: input.idempotency_key,
    })
    return {
      payment_intent_id: intent.id,
      client_secret: intent.client_secret!,
      amount: quote.total,
      currency_code: quote.region.currency_code,
      provider: "stripe" as const,
    }
  } catch (error) {
    if (error instanceof StripePaymentError) throw new PurchaseError(error.status, error.message)
    throw error
  }
}

/**
 * Coordinates the MVP checkout use case. The route only handles HTTP concerns;
 * this function owns marketplace validation, pricing, locking, order creation,
 * and the shared post-order lifecycle transition. See AI_CONTEXT.md,
 * "Stripe PaymentIntent checkout".
 */
export const executeStripeCheckout = async (
  container: any,
  customerId: string,
  input: DummyCheckoutInput
) => {
  const items = validateItems(input)
  if (!input.payment_intent_id) {
    throw new PurchaseError(400, "payment_intent_id is required after Stripe confirmation")
  }
  const orderService = container.resolve(Modules.ORDER) as any
  // Handle the common retry after an HTTP timeout. This must happen before
  // checking AVAILABLE because the first completion may already have sold it.
  const [existingOrder] = await orderService.listOrders(
    { metadata: { stripe_payment_intent_id: input.payment_intent_id } },
    { take: 1 }
  )
  if (existingOrder) {
    if (existingOrder.customer_id !== customerId) {
      throw new PurchaseError(403, "Stripe payment does not belong to this customer")
    }
    await processOrderPlaced(existingOrder.id, container)
    return existingOrder
  }
  const { region, salesChannel } = await getRegionAndSalesChannel(container, input)
  const initial = await getListingsForVariants(container, items.map((item) => item.variantId))
  const locking = container.resolve(Modules.LOCKING) as any
  const lockKeys = [...initial.listingByVariant.values()]
    .map((listing: any) => `marketplace-listing:${listing.id}`)
    .sort()

  return locking.execute(lockKeys, async () => {
    // A concurrent request may have completed this same Intent while this
    // request waited for the Listing lock.
    const [completedOrder] = await orderService.listOrders(
      { metadata: { stripe_payment_intent_id: input.payment_intent_id } },
      { take: 1 }
    )
    if (completedOrder) {
      if (completedOrder.customer_id !== customerId) {
        throw new PurchaseError(403, "Stripe payment does not belong to this customer")
      }
      await processOrderPlaced(completedOrder.id, container)
      return completedOrder
    }
    // Re-read under the lock: a competing checkout may have sold the item
    // between the initial lookup and lock acquisition.
    const quote = await getCheckoutQuote(container, customerId, input)
    const expectedPayment = {
      amount: quote.total,
      currency_code: quote.region.currency_code,
      customer_id: customerId,
      region_id: quote.region.id,
      item_fingerprint: quote.itemFingerprint,
    }
    try {
      if (isDemoPaymentIntent(input.payment_intent_id!)) {
        assertSucceededDemoPayment(input.payment_intent_id!, expectedPayment)
      } else {
        const stripeIntent = await retrieveStripePaymentIntent(input.payment_intent_id!)
        assertSucceededStripePayment(stripeIntent, expectedPayment)
      }
    } catch (error) {
      if (error instanceof StripePaymentError) throw new PurchaseError(error.status, error.message)
      throw error
    }
    const orderItems = items.map((item) => {
      const variant = quote.variantsById.get(item.variantId)
      return {
        variant_id: variant.id,
        product_id: variant.product_id,
        title: variant.title ?? "Marketplace item",
        quantity: 1,
        unit_price: quote.prices.get(variant.id),
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
        metadata: { stripe_payment_intent_id: input.payment_intent_id },
      } as any,
    })

    await processOrderPlaced(order.id, container)
    return order
  }, { timeout: 10, expire: 60 })
}

// Kept temporarily for imports outside the HTTP route while callers migrate
// to the explicit Stripe name. See documentation/AI_CONTEXT.md.
export const executeDummyCheckout = executeStripeCheckout
