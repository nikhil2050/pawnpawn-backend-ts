import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

type SellerUpdatedData = {
  id: string
  handle?: string
  store_name?: string
}

/** Keeps legacy/search-friendly product metadata synchronized with Seller. */
export default async function sellerUpdatedProductMetadata({
  event: { data },
  container,
}: SubscriberArgs<SellerUpdatedData>) {
  const sellerService = container.resolve<any>("seller")
  const seller = await sellerService.retrieveSeller(data.id)
  const listingService = container.resolve<any>("listing")
  const productService = container.resolve<any>(Modules.PRODUCT)
  const listings = await listingService.listListings({ seller_id: seller.id })

  for (const listing of listings) {
    const product = await productService.retrieveProduct(listing.product_id)
    // Metadata is a compatibility/search projection; ownership stays on Listing.
    // See documentation/AI_CONTEXT.md §5.3.
    await productService.updateProducts(product.id, {
      metadata: {
        ...(product.metadata ?? {}),
        seller_id: seller.id,
        seller_handle: seller.handle,
        seller_name: seller.store_name,
      },
    })
  }
}

export const config: SubscriberConfig = { event: "seller.updated" }
