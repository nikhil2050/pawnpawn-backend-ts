import { Modules } from "@medusajs/framework/utils"

/**
 * Builds an administrator-only provenance projection. It retains internal
 * order-line and buyer identifiers needed for dispute resolution while keeping
 * Seller ownership resolved through the Listing and Lineage modules.
 */
export const getAdminProductLineage = async (container: any, productId: string) => {
  const productService = container.resolve(Modules.PRODUCT) as any
  const lineageService = container.resolve("lineage") as any
  const listingService = container.resolve("listing") as any
  const sellerService = container.resolve("seller") as any
  const hqService = container.resolve("hq_fulfillment") as any

  const product = await productService.retrieveProduct(productId, { withDeleted: true })
  const [listing] = await listingService.listListings(
    { product_id: productId },
    { withDeleted: true, take: 1 }
  )
  const transfers = await lineageService.getLineageHistory(productId)
  const fulfillments = await hqService.listHqFulfillments(
    { product_id: productId },
    { withDeleted: true, take: 100 }
  )
  const sellerIds = [...new Set([
    listing?.seller_id,
    ...transfers.map((transfer: any) => transfer.seller_id),
    ...fulfillments.map((fulfillment: any) => fulfillment.seller_id),
  ].filter(Boolean))]
  const sellers = sellerIds.length
    ? await sellerService.listSellers({ id: sellerIds }, { withDeleted: true, take: sellerIds.length })
    : []
  const sellersById = new Map<string, any>(sellers.map((seller: any) => [seller.id, seller]))

  const sellerSummary = (sellerId: string | null | undefined) => {
    const seller = sellerId ? sellersById.get(sellerId) : undefined
    return seller
      ? {
          id: seller.id,
          handle: seller.handle,
          store_name: seller.store_name,
          seller_trust: seller.seller_trust,
          verification_status: seller.verification_status,
          is_deactivated: seller.is_deactivated,
        }
      : null
  }

  return {
    product: {
      id: product.id,
      title: product.title,
      handle: product.handle,
      deleted_at: product.deleted_at ?? null,
    },
    listing: listing
      ? {
          id: listing.id,
          listing_status: listing.listing_status,
          seller: sellerSummary(listing.seller_id),
          admin_feedback: listing.admin_feedback,
          reviewed_by: listing.reviewed_by,
          reviewed_at: listing.reviewed_at,
        }
      : null,
    lineage: transfers.map((transfer: any) => ({
      id: transfer.id,
      order_line_item_id: transfer.order_line_item_id,
      seller: sellerSummary(transfer.seller_id),
      buyer_id: transfer.buyer_id,
      price: transfer.price,
      transacted_at: transfer.transacted_at,
      voided_at: transfer.voided_at,
      voided_reason: transfer.voided_reason,
    })),
    hq_fulfillments: fulfillments.map((fulfillment: any) => ({
      id: fulfillment.id,
      order_id: fulfillment.order_id,
      order_line_item_id: fulfillment.order_line_item_id,
      seller: sellerSummary(fulfillment.seller_id),
      buyer_id: fulfillment.buyer_id,
      hq_status: fulfillment.hq_status,
      certificate_url: fulfillment.certificate_url,
      payout_released_at: fulfillment.payout_released_at,
      refund_amount: fulfillment.refund_amount,
      refund_status: fulfillment.refund_status,
      exception_reason: fulfillment.exception_reason,
      exception_at: fulfillment.exception_at,
    })),
  }
}
