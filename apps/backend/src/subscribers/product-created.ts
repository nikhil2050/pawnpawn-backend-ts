import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { randomUUID } from "node:crypto"

type ProductCreatedData = {
  id: string
}

type SellerProfile = {
  id: string
  handle: string
  store_name: string
}

const SYSTEM_SELLER_HANDLE = "system"
const SYSTEM_CATEGORY_PREFIX = "GEN"

const categoryPrefixFor = (product: any) => {
  const categoryText = [
    product.metadata?.category_id,
    ...(product.categories ?? []).flatMap((category: any) => [category.handle, category.name]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (categoryText.includes("footwear")) return "FTW"
  if (categoryText.includes("outerwear")) return "OUT"
  if (categoryText.includes("accessor")) return "ACC"
  if (categoryText.includes("apparel")) return "APP"

  return SYSTEM_CATEGORY_PREFIX
}

const isStandardSku = (sku: string | null | undefined) =>
  /^CELEB-[A-Z0-9-]+-(APP|OUT|FTW|ACC|GEN)-[A-F0-9]{8}$/.test(sku ?? "")

const normalizeHandle = (handle: string | null | undefined) =>
  String(handle ?? SYSTEM_SELLER_HANDLE)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "SYSTEM"

const getOrCreateSystemSeller = async (sellerService: any): Promise<SellerProfile> => {
  const [existing] = await sellerService.listSellers(
    { handle: SYSTEM_SELLER_HANDLE, is_deactivated: false },
    { take: 1 }
  )
  if (existing) return existing

  try {
    return await sellerService.createSellers({
      handle: SYSTEM_SELLER_HANDLE,
      store_name: "PawnPawn System",
      seller_trust: "trusted",
      seller_category: "other",
      verification_status: "VERIFIED",
      is_deactivated: false,
    })
  } catch (error) {
    // Concurrent product.created handlers can both provision the system
    // seller. Re-read the unique handle before treating it as a failure.
    const [createdByAnotherHandler] = await sellerService.listSellers(
      { handle: SYSTEM_SELLER_HANDLE, is_deactivated: false },
      { take: 1 }
    )
    if (createdByAnotherHandler) return createdByAnotherHandler
    throw error
  }
}

const resolveSeller = async (product: any, sellerService: any): Promise<SellerProfile> => {
  const sellerId = product.metadata?.seller_id
  if (typeof sellerId === "string") {
    const [seller] = await sellerService.listSellers(
      { id: sellerId, is_deactivated: false },
      { take: 1 }
    )
    if (seller) return seller
  }

  const sellerHandle = product.metadata?.seller_handle
  if (typeof sellerHandle === "string") {
    const [seller] = await sellerService.listSellers(
      { handle: sellerHandle, is_deactivated: false },
      { take: 1 }
    )
    if (seller) return seller
  }

  return getOrCreateSystemSeller(sellerService)
}

const nextSku = async (
  productService: any,
  sellerHandle: string,
  categoryPrefix: string
) => {
  for (;;) {
    const shortId = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()
    const sku = `CELEB-${normalizeHandle(sellerHandle)}-${categoryPrefix}-${shortId}`
    const existing = await productService.listProductVariants({ sku }, { take: 1 })
    if (!existing.length) return sku
  }
}

const ensureOneOfOneInventoryLevels = async (
  container: SubscriberArgs<ProductCreatedData>["container"],
  product: any,
  inventoryService: any,
  logger: any
) => {
  const query = container.resolve<any>(ContainerRegistrationKeys.QUERY)
  const stockLocationService = container.resolve<any>(Modules.STOCK_LOCATION)
  const variants = product.variants ?? []
  if (!variants.length) return

  const { data: inventoryLinks } = await query.graph({
    entity: "product_variant_inventory_item",
    fields: ["variant_id", "inventory_item_id"],
    filters: { variant_id: variants.map((variant: any) => variant.id) },
  })
  if (!inventoryLinks.length) {
    logger?.warn?.(`No inventory items were created for product ${product.id}`)
    return
  }

  const [stockLocation] = await stockLocationService.listStockLocations({}, { take: 1 })
  if (!stockLocation) {
    logger?.warn?.(`No stock location exists for product ${product.id}; inventory level was not set`)
    return
  }

  for (const link of inventoryLinks) {
    const levels = await inventoryService.listInventoryLevels({
      inventory_item_id: link.inventory_item_id,
    })
    const primaryLevel =
      levels.find((level: any) => level.location_id === stockLocation.id) ?? levels[0]

    if (!primaryLevel) {
      await inventoryService.createInventoryLevels({
        inventory_item_id: link.inventory_item_id,
        location_id: stockLocation.id,
        stocked_quantity: 1,
      })
      continue
    }

    await inventoryService.updateInventoryLevels(
      levels.map((level: any) => ({
        id: level.id,
        inventory_item_id: level.inventory_item_id,
        location_id: level.location_id,
        stocked_quantity: level.id === primaryLevel.id ? 1 : 0,
      }))
    )
  }
}

const ensureListing = async (listingService: any, product: any, seller: SellerProfile) => {
  const [existing] = await listingService.listListings({ product_id: product.id }, { take: 1 })
  if (existing) return existing

  try {
    return await listingService.createListings({
      product_id: product.id,
      seller_id: seller.id,
      listing_status: "PENDING_APPROVAL",
      listing_type: product.metadata?.listing_type === "AUCTION" ? "AUCTION" : "FIXED_PRICE",
      item_condition: typeof product.metadata?.item_condition === "string"
        ? product.metadata.item_condition
        : null,
    })
  } catch (error) {
    // product_id is unique on Listing. If another creation path won the race,
    // return that row and let product creation continue normally.
    const [createdByAnotherHandler] = await listingService.listListings(
      { product_id: product.id },
      { take: 1 }
    )
    if (createdByAnotherHandler) return createdByAnotherHandler
    throw error
  }
}

// Provisions marketplace defaults for products created through either the
// seller endpoint or Medusa's native Admin API. See AI_CONTEXT.md §4.2.
export default async function productCreated({
  event: { data },
  container,
}: SubscriberArgs<ProductCreatedData>) {
  const logger = container.resolve<any>(ContainerRegistrationKeys.LOGGER)

  try {
    const productService = container.resolve<any>(Modules.PRODUCT)
    const inventoryService = container.resolve<any>(Modules.INVENTORY)
    const listingService = container.resolve<any>("listing")
    const sellerService = container.resolve<any>("seller")
    const product = await productService.retrieveProduct(data.id, {
      relations: ["variants", "categories"],
    })
    const seller = await resolveSeller(product, sellerService)
    const categoryPrefix = categoryPrefixFor(product)
    const variantUpdates = await Promise.all(
      (product.variants ?? []).map(async (variant: any) => ({
        id: variant.id,
        sku: isStandardSku(variant.sku)
          ? variant.sku
          : await nextSku(productService, seller.handle, categoryPrefix),
        manage_inventory: true,
        allow_backorder: false,
      }))
    )

    try {
      if (variantUpdates.length) {
        await updateProductVariantsWorkflow(container).run({
          input: { product_variants: variantUpdates },
        })
      }
      await ensureOneOfOneInventoryLevels(container, product, inventoryService, logger)
    } catch (error) {
      logger?.error?.(`Unable to configure one-of-one inventory for product ${product.id}`, error)
    }

    try {
      await ensureListing(listingService, product, seller)
    } catch (error) {
      logger?.error?.(`Unable to provision a Listing for product ${product.id}`, error)
    }

    try {
      if (product.metadata?.seller_id !== seller.id) {
        // Keep denormalized display metadata in sync without changing Listing,
        // which remains the marketplace ownership source of truth.
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
    } catch (error) {
      logger?.error?.(`Unable to synchronize seller metadata for product ${product.id}`, error)
    }
  } catch (error) {
    // Product creation has already committed when this event is delivered.
    // Log provisioning failures instead of propagating them to the creator.
    logger?.error?.(`Unable to provision marketplace defaults for product ${data.id}`, error)
  }
}

export const config: SubscriberConfig = { event: "product.created" }
