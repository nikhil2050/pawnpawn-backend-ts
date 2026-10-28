import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { refetchEntities } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { attachMarketplaceListings } from "../../../workflows/admin/product-marketplace"
import { remapAdminProductFields, serializeAdminProduct } from "./serialization"

const listingStatuses = new Set([
  "PENDING_APPROVAL",
  "AVAILABLE",
  "SOLD",
  "REJECTED",
])

const getListingStatus = (value: unknown) => {
  if (typeof value !== "string" || !listingStatuses.has(value)) return undefined
  return value as "PENDING_APPROVAL" | "AVAILABLE" | "SOLD" | "REJECTED"
}

const isTrue = (value: string | null) => value === "true"

const asIdList = (value: unknown): string[] => {
  if (typeof value === "string") return [value]
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []
}

/**
 * Extends Medusa's Admin product list response with Listing-backed marketplace
 * mapping. Core product filtering and pagination stay in Medusa's query layer.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Read the custom parameter from the original URL as core Medusa query
  // validation only retains native product filters in req.query.
  const requestUrl = new URL((req as any).originalUrl ?? req.url, "http://localhost")
  const listingStatus = getListingStatus(
    requestUrl.searchParams.get("listing_status") ?? (req.query as Record<string, unknown>).listing_status
  )
  const includeArchived = isTrue(requestUrl.searchParams.get("include_archived"))
  const filterableFields = { ...((req as any).filterableFields ?? {}) }
  const requestedIds = asIdList(filterableFields.id)
  let marketplaceProductIds: string[] | undefined

  if (includeArchived) {
    // The core Product table remains unchanged. Resolve archived IDs through
    // Medusa's service, then let the native Admin query retain pagination.
    const productService = req.scope.resolve<any>(Modules.PRODUCT)
    const products = await productService.listProducts({}, { withDeleted: true, take: 100000 })
    marketplaceProductIds = products
      .filter((product: any) => product.deleted_at)
      .map((product: any) => product.id)
  }

  if (listingStatus) {
    // Apply marketplace-state filtering before querying Medusa products so
    // pagination and counts remain correct. Listing remains the ownership and
    // lifecycle source; native Product tables are not modified.
    const listingService = req.scope.resolve<any>("listing")
    const listings = await listingService.listListings({ listing_status: listingStatus }, { take: 100000 })
    const listingProductIds = listings.map((listing: any) => listing.product_id)
    marketplaceProductIds = marketplaceProductIds
      ? marketplaceProductIds.filter((id) => listingProductIds.includes(id))
      : listingProductIds
  }

  if (marketplaceProductIds) {
    const matchingIds = requestedIds.length
      ? requestedIds.filter((id) => marketplaceProductIds!.includes(id))
      : marketplaceProductIds

    if (!matchingIds.length) {
      const pagination = (req as any).queryConfig?.pagination
      return res.json({ products: [], count: 0, offset: pagination?.skip ?? 0, limit: pagination?.take ?? 20 })
    }
    filterableFields.id = matchingIds
  }

  const { data, metadata } = await refetchEntities({
    entity: "product",
    idOrFilter: filterableFields,
    scope: req.scope,
    fields: remapAdminProductFields((req as any).queryConfig?.fields ?? []),
    pagination: (req as any).queryConfig?.pagination,
    withDeleted: includeArchived || (req as any).queryConfig?.withDeleted,
  })
  const products = await attachMarketplaceListings(
    req.scope,
    data.map(serializeAdminProduct),
    { withDeleted: includeArchived }
  )

  res.json({
    products,
    count: metadata.count,
    offset: metadata.skip,
    limit: metadata.take,
  })
}
