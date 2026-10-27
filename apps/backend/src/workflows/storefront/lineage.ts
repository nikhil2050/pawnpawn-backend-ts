import { Modules } from "@medusajs/framework/utils"

/**
 * Public provenance projection. Buyer records intentionally expose only their
 * opaque customer IDs; customer names, email addresses, and payment data are
 * never part of a public ownership history. See AI_CONTEXT.md §8.10.
 */
export const getPublicLineage = async (container: any, productId: string) => {
  const product = container.resolve(Modules.PRODUCT) as any
  const lineage = container.resolve("lineage") as any
  const seller = container.resolve("seller") as any
  await product.retrieveProduct(productId)
  const transfers: any[] = await lineage.getLineageHistory(productId)
  const sellerIds = [...new Set(transfers.map((transfer) => transfer.seller_id).filter(Boolean))]
  const sellers: any[] = sellerIds.length
    ? await seller.listSellers({ id: sellerIds }, { take: sellerIds.length })
    : []
  const sellersById = new Map(sellers.map((profile) => [profile.id, profile]))

  return {
    product_id: productId,
    lineage: transfers.map((transfer) => {
      const profile = sellersById.get(transfer.seller_id)
      return {
        id: transfer.id,
        seller: profile
          ? {
              id: profile.id,
              handle: profile.handle,
              store_name: profile.store_name,
              avatar_url: profile.avatar_url,
            }
          : null,
        buyer: { id: transfer.buyer_id },
        price: transfer.price,
        transacted_at: transfer.transacted_at,
        voided_at: transfer.voided_at,
      }
    }),
  }
}
