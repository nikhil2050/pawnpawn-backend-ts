import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework/subscribers"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

type ProductDeletedData = { id: string }

/**
 * Mirrors native Product soft deletion into the Listing module. A queued
 * product.deleted event must never re-archive a Listing after that Product
 * has been restored by the admin archive workflow. See AI_CONTEXT.md §8.11.
 */
export default async function productDeleted({
  event: { data },
  container,
}: SubscriberArgs<ProductDeletedData>) {
  const productService = container.resolve<any>(Modules.PRODUCT)
  const listingService = container.resolve<any>("listing")
  const logger = container.resolve<any>(ContainerRegistrationKeys.LOGGER)

  try {
    const product = await productService
      .retrieveProduct(data.id, { withDeleted: true })
      .catch(() => null)

    // Events are asynchronous. If a restore completed first, treating this
    // stale event as current would sever the restored marketplace mapping.
    if (!product?.deleted_at) return

    const [listing] = await listingService.listListings(
      { product_id: data.id },
      { withDeleted: true, take: 1 }
    )
    if (listing && !listing.deleted_at) {
      await listingService.deleteListings(listing.id)
    }
  } catch (error) {
    // Product deletion must not fail after Medusa has completed its core soft
    // delete. The archive item remains reconcilable and is logged for review.
    logger?.error?.(`Unable to archive Listing for product ${data.id}`, error)
  }
}

export const config: SubscriberConfig = { event: "product.deleted" }
