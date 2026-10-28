import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework/subscribers"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type ProductDeletedData = { id: string }

/**
 * Mirrors Medusa's soft deletion into the custom Listing module. This keeps
 * lineage intact while removing the Listing from active moderation queries.
 * See documentation/AI_CONTEXT.md §8.11.
 */
export default async function productDeleted({
  event: { data },
  container,
}: SubscriberArgs<ProductDeletedData>) {
  const listingService = container.resolve<any>("listing")
  const logger = container.resolve<any>(ContainerRegistrationKeys.LOGGER)

  try {
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
