import { MedusaError, Modules } from "@medusajs/framework/utils"

export type MarketplaceSeller = {
  id: string
  store_name: string
  handle: string
  avatar_url: string | null
}

export type MarketplaceReviewer = {
  id: string
  name: string
  email: string | null
}

export type MarketplaceListing = {
  id: string
  product_id: string
  seller_id: string
  listing_status: "PENDING_APPROVAL" | "AVAILABLE" | "SOLD" | "REJECTED"
  admin_feedback: string | null
  reviewed_by: string | null
  reviewed_at: Date | null
  seller: MarketplaceSeller | null
  reviewer: MarketplaceReviewer | null
}

const toMarketplaceListing = (listing: any, seller?: any, reviewer?: any): MarketplaceListing => ({
  id: listing.id,
  product_id: listing.product_id,
  seller_id: listing.seller_id,
  listing_status: listing.listing_status,
  admin_feedback: listing.admin_feedback ?? null,
  reviewed_by: listing.reviewed_by ?? null,
  reviewed_at: listing.reviewed_at ?? null,
  seller: seller
    ? {
        id: seller.id,
        store_name: seller.store_name,
        handle: seller.handle,
        avatar_url: seller.avatar_url,
      }
    : null,
  reviewer: reviewer
    ? {
        id: reviewer.id,
        name: [reviewer.first_name, reviewer.last_name].filter(Boolean).join(" ") || reviewer.email || reviewer.id,
        email: reviewer.email ?? null,
      }
    : null,
})

/**
 * Maps products to their marketplace Listing and Seller. Listing is the sole
 * ownership source; this workflow never reads product metadata. See
 * documentation/AI_CONTEXT.md §8.11.
 */
export const getMarketplaceListingsForProducts = async (
  container: any,
  productIds: string[],
  options: { withDeleted?: boolean } = {}
) => {
  if (!productIds.length) return new Map<string, MarketplaceListing>()

  const listingService = container.resolve("listing") as any
  const sellerService = container.resolve("seller") as any
  const userService = container.resolve(Modules.USER) as any
  const listings: any[] = await listingService.listListings(
    { product_id: productIds },
    { withDeleted: options.withDeleted, take: productIds.length }
  )
  const sellerIds = [...new Set(listings.map((listing) => listing.seller_id).filter(Boolean))]
  const sellers: any[] = sellerIds.length
    ? await sellerService.listSellers({ id: sellerIds }, { take: sellerIds.length })
    : []
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]))
  const reviewerIds = [...new Set(listings.map((listing) => listing.reviewed_by).filter(Boolean))]
  const reviewers: any[] = reviewerIds.length
    ? await userService.listUsers({ id: reviewerIds }, { take: reviewerIds.length })
    : []
  const reviewerById = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]))

  return new Map(
    listings.map((listing) => [
      listing.product_id,
      toMarketplaceListing(listing, sellerById.get(listing.seller_id), reviewerById.get(listing.reviewed_by)),
    ])
  )
}

export const attachMarketplaceListings = async (
  container: any,
  products: any[],
  options: { withDeleted?: boolean } = {}
) => {
  const mappings = await getMarketplaceListingsForProducts(
    container,
    products.map((product) => product.id),
    options
  )
  return products.map((product) => ({
    ...product,
    marketplace_listing: mappings.get(product.id) ?? null,
  }))
}

export const getProductMarketplaceListing = async (container: any, productId: string) => {
  const productService = container.resolve(Modules.PRODUCT) as any
  const existingProduct = await productService.retrieveProduct(productId, { withDeleted: true }).catch(() => null)
  if (!existingProduct) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
  }
  const [product] = await attachMarketplaceListings(container, [{ id: productId }], { withDeleted: true })
  return product.marketplace_listing as MarketplaceListing | null
}

export const reassignProductMarketplaceListing = async (
  container: any,
  productId: string,
  sellerId: string
) => {
  const listingService = container.resolve("listing") as any
  const sellerService = container.resolve("seller") as any
  const [listing] = await listingService.listListings({ product_id: productId }, { take: 1 })
  if (!listing) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Marketplace listing for product "${productId}" was not found`
    )
  }

  const seller = await sellerService.retrieveSeller(sellerId).catch(() => null)
  if (!seller || seller.is_deactivated) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "An active seller is required"
    )
  }

  const updated = await listingService.updateListings({ id: listing.id, seller_id: seller.id })
  return toMarketplaceListing(updated, seller)
}
