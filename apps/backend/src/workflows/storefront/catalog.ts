import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export type CatalogQuery = {
  category_id?: string | string[]
  collection_id?: string | string[]
  options?: string | string[]
  limit?: string
  offset?: string
}

export type CatalogContext = {
  sales_channel_ids?: string[]
}

const values = (value?: string | string[]) =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((entry) => entry.split(",").map((part) => part.trim()))
    .filter(Boolean)

const optionFilters = (query: CatalogQuery) => values(query.options).map((entry) => {
  const separator = entry.indexOf(":")
  return separator < 1
    ? { value: entry.toLowerCase() }
    : { title: entry.slice(0, separator).trim().toLowerCase(), value: entry.slice(separator + 1).trim().toLowerCase() }
})

const matchesOptions = (product: any, filters: ReturnType<typeof optionFilters>) => {
  if (!filters.length) return true
  const available = (product.options ?? []).flatMap((option: any) =>
    (option.values ?? []).map((value: any) => ({
      title: String(option.title ?? "").trim().toLowerCase(),
      value: String(value.value ?? "").trim().toLowerCase(),
    }))
  )
  return filters.every((filter) => available.some((entry: any) =>
    entry.value === filter.value && (!filter.title || entry.title === filter.title)
  ))
}

const toPublicListing = (listing: any) => ({
  id: listing.id,
  listing_status: listing.listing_status,
  listing_type: listing.listing_type,
  item_condition: listing.item_condition,
})

/**
 * Storefront catalog use case. Listing status is resolved from the custom
 * Listing module while taxonomy and option filters use native Product data.
 * See documentation/AI_CONTEXT.md §8.8.
 */
export const listAvailableCatalog = async (
  container: any,
  query: CatalogQuery,
  context: CatalogContext = {}
) => {
  const listing = container.resolve("listing") as any
  const product = container.resolve(Modules.PRODUCT) as any
  const seller = container.resolve("seller") as any
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const availableListings: any[] = await listing.listListings({ listing_status: "AVAILABLE" })
  const listingByProduct = new Map(availableListings.map((entry: any) => [entry.product_id, entry]))
  const productIds = [...listingByProduct.keys()]
  if (!productIds.length) return { products: [], count: 0, offset: 0, limit: 0 }

  const categoryIds = values(query.category_id)
  const collectionIds = values(query.collection_id)
  const optionFilter = optionFilters(query)
  const scopedProductIds = context.sales_channel_ids?.length
    ? (await queryService.graph({
        entity: "product_sales_channel",
        fields: ["product_id"],
        filters: { product_id: productIds, sales_channel_id: context.sales_channel_ids },
      })).data.map((entry: any) => entry.product_id)
    : productIds
  if (!scopedProductIds.length) return { products: [], count: 0, offset: 0, limit: 0 }
  const products = await product.listProducts(
    { id: scopedProductIds, status: "published" },
    { relations: ["categories", "options", "options.values", "variants"], take: productIds.length }
  )
  const filtered = products.filter((entry: any) => {
    const categories = entry.categories ?? []
    const categoryMatch = !categoryIds.length || categories.some((category: any) => categoryIds.includes(category.id))
    const collectionMatch = !collectionIds.length || collectionIds.includes(entry.collection_id)
    return categoryMatch && collectionMatch && matchesOptions(entry, optionFilter)
  })
  const sellerIds = [...new Set(filtered.map((entry: any) => listingByProduct.get(entry.id)?.seller_id).filter(Boolean))]
  const sellers: any[] = sellerIds.length ? await seller.listSellers({ id: sellerIds }, { take: sellerIds.length }) : []
  const sellerById = new Map(sellers.map((entry: any) => [entry.id, entry]))
  const enriched = filtered.map((entry: any) => {
    const currentListing = listingByProduct.get(entry.id)
    const profile = sellerById.get(currentListing?.seller_id)
    return {
      ...entry,
      marketplace_listing: toPublicListing(currentListing),
      seller: profile ? { id: profile.id, handle: profile.handle, store_name: profile.store_name, avatar_url: profile.avatar_url } : null,
    }
  })
  const offset = Math.max(0, Number(query.offset ?? 0) || 0)
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20) || 20))
  return { products: enriched.slice(offset, offset + limit), count: enriched.length, offset, limit }
}

export const getSellerCatalog = async (container: any, handle: string) => {
  const sellerService = container.resolve("seller") as any
  const listingService = container.resolve("listing") as any
  const productService = container.resolve(Modules.PRODUCT) as any
  const profile = await sellerService.findByHandle(handle)
  if (!profile || profile.is_deactivated) return null
  const listings: any[] = await listingService.listListings({ seller_id: profile.id, listing_status: ["AVAILABLE", "SOLD"] })
  const productIds = listings.map((entry: any) => entry.product_id)
  const products: any[] = productIds.length
    ? await productService.listProducts({ id: productIds }, { relations: ["categories", "options", "options.values", "variants"], take: productIds.length })
    : []
  const productById = new Map(products.map((entry: any) => [entry.id, entry]))
  const active: any[] = []
  const archive: any[] = []
  for (const listing of listings) {
    const entry = productById.get(listing.product_id)
    if (!entry) continue
    const result = { ...entry, marketplace_listing: toPublicListing(listing) }
    if (listing.listing_status === "AVAILABLE") active.push(result)
    else archive.push(result)
  }
  return {
    seller: { id: profile.id, handle: profile.handle, store_name: profile.store_name, avatar_url: profile.avatar_url, bio: profile.bio },
    products: active,
    archive,
  }
}
