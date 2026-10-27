import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export type HqExceptionInput = {
  action?: "SPLIT_DISPATCH" | "CANCEL_AND_REFUND"
  target_status?: "AUTHENTICATED_AND_PACKED" | "DISPATCHED"
  refund_amount?: number
  reason?: string
}

export class HqExceptionError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

const restoreInventory = async (container: any, variantId: string) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const inventory = container.resolve(Modules.INVENTORY) as any
  const { data: links } = await query.graph({
    entity: "product_variant_inventory_item",
    fields: ["variant_id", "inventory_item_id"],
    filters: { variant_id: [variantId] },
  })
  for (const link of links ?? []) {
    const levels = await inventory.listInventoryLevels({ inventory_item_id: link.inventory_item_id })
    if (levels.length) {
      const primaryLevel = levels[0]
      await inventory.updateInventoryLevels(levels.map((level: any) => ({
        id: level.id,
        inventory_item_id: level.inventory_item_id,
        location_id: level.location_id,
        stocked_quantity: level.id === primaryLevel.id ? 1 : 0,
      })))
    }
  }
}

const refundLine = async (container: any, order: any, item: any, amount: number, hqId: string, reason: string) => {
  const payment = container.resolve(Modules.PAYMENT) as any
  const collections = order.payment_collections ?? []
  const payments = collections.flatMap((collection: any) => collection.payments ?? [])
  const capturedPayment = payments.find((entry: any) => entry.captured_at || Number(entry.captured_amount) > 0)

  // The MVP checkout has no payment collection. Preserve a refund audit state
  // without pretending that money moved through a provider.
  if (!capturedPayment) return { status: "SKIPPED_DUMMY" as const, provider: "dummy" }

  await payment.refundPayment({
    payment_id: capturedPayment.id,
    amount,
    note: reason,
    idempotency_key: `hq-exception:${hqId}`,
  })
  return { status: "REFUNDED" as const, provider: "medusa-payment" }
}

/**
 * Handles one HQ line item without changing sibling lines in a mixed cart.
 * Split dispatch updates only this fulfillment; cancellation restores the
 * unique item and voids its ownership transfer. See AI_CONTEXT.md §8.7.
 */
export const executeHqException = async (
  container: any,
  fulfillmentId: string,
  input: HqExceptionInput,
  adminId = "admin"
) => {
  const hq = container.resolve("hq_fulfillment") as any
  const fulfillment = await hq.retrieveHqFulfillment(fulfillmentId)
  if (!fulfillment) throw new HqExceptionError(404, "HQ fulfillment was not found")
  if (!input.action) throw new HqExceptionError(400, "action is required")

  if (input.action === "SPLIT_DISPATCH") {
    if (!input.target_status) {
      throw new HqExceptionError(400, "target_status is required for SPLIT_DISPATCH")
    }
    if (["DELIVERED", "CANCELLED_BY_SELLER"].includes(fulfillment.hq_status)) {
      throw new HqExceptionError(409, "This fulfillment can no longer be dispatched")
    }
    return hq.updateHqFulfillments({
      id: fulfillment.id,
      hq_status: input.target_status,
      exception_by: adminId,
      exception_at: new Date(),
      exception_reason: input.reason ?? "Partial dispatch approved",
    })
  }

  if (fulfillment.hq_status === "CANCELLED_BY_SELLER") return fulfillment
  if (fulfillment.hq_status === "DELIVERED") {
    throw new HqExceptionError(409, "Delivered fulfillment cannot be cancelled")
  }
  const reason = input.reason?.trim()
  if (!reason) throw new HqExceptionError(400, "reason is required for cancellation")

  const orderService = container.resolve(Modules.ORDER) as any
  const order = await orderService.retrieveOrder(fulfillment.order_id, {
    relations: ["items", "payment_collections", "payment_collections.payments"],
  })
  const item = (order.items ?? []).find((entry: any) => entry.id === fulfillment.order_line_item_id)
  if (!item) throw new HqExceptionError(404, "The order line for this fulfillment was not found")
  const lineAmount = Number(item.unit_price ?? 0) * Number(item.quantity ?? 1)
  const refundAmount = input.refund_amount == null ? lineAmount : Number(input.refund_amount)
  if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > lineAmount) {
    throw new HqExceptionError(400, "refund_amount must be greater than zero and no more than the line total")
  }

  const refund = await refundLine(container, order, item, refundAmount, fulfillment.id, reason)
  const listing = container.resolve("listing") as any
  const seller = container.resolve("seller") as any
  const product = container.resolve(Modules.PRODUCT) as any
  const lineage = container.resolve("lineage") as any

  await restoreInventory(container, item.variant_id)
  await listing.updateListings({ id: fulfillment.listing_id, listing_status: "AVAILABLE" })
  await product.updateProducts({ id: fulfillment.product_id, status: "published" })
  await seller.updateSellers({
    id: fulfillment.seller_id,
    seller_trust: "untrusted",
    is_flagged: true,
    flag_reason: reason,
    flagged_at: new Date(),
  })
  await lineage.updateProductLineages({
    order_line_item_id: fulfillment.order_line_item_id,
    voided_at: new Date(),
    voided_reason: reason,
  })

  return hq.updateHqFulfillments({
    id: fulfillment.id,
    hq_status: "CANCELLED_BY_SELLER",
    refund_amount: refundAmount,
    refund_status: refund.status,
    exception_reason: reason,
    exception_by: adminId,
    exception_at: new Date(),
  })
}
