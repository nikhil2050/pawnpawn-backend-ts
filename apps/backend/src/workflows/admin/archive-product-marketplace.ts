import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

export type ProductArchiveAction = "ARCHIVE" | "RESTORE"

type ProductArchiveInput = {
  product_id: string
  action: ProductArchiveAction
}

type ProductListingPair = {
  product_id: string
  product_deleted_at: Date | null
  listing_id: string
  listing_deleted_at: Date | null
  action: ProductArchiveAction
}

export const resolveProductListingForArchiveStepId = "resolve-product-listing-for-archive"
const resolveProductListingForArchiveStep = createStep(
  resolveProductListingForArchiveStepId,
  async (input: ProductArchiveInput, { container }) => {
    const productService = container.resolve<any>(Modules.PRODUCT)
    const listingService = container.resolve<any>("listing")
    const product = await productService
      .retrieveProduct(input.product_id, { withDeleted: true })
      .catch(() => null)
    if (!product) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
    }

    const [listing] = await listingService.listListings(
      { product_id: product.id },
      { withDeleted: true, take: 1 }
    )
    if (!listing) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No marketplace Listing is linked to this product"
      )
    }

    return new StepResponse({
      product_id: product.id,
      product_deleted_at: product.deleted_at ?? null,
      listing_id: listing.id,
      listing_deleted_at: listing.deleted_at ?? null,
      action: input.action,
    } satisfies ProductListingPair)
  }
)

export const updateMarketplaceListingArchiveStateStepId = "update-marketplace-listing-archive-state"
const updateMarketplaceListingArchiveStateStep = createStep(
  updateMarketplaceListingArchiveStateStepId,
  async (pair: ProductListingPair, { container }) => {
    const listingService = container.resolve<any>("listing")
    const changed = pair.action === "ARCHIVE"
      ? !pair.listing_deleted_at
      : Boolean(pair.listing_deleted_at)

    if (changed) {
      if (pair.action === "ARCHIVE") {
        await listingService.softDeleteListings([pair.listing_id])
      } else {
        await listingService.restoreListings([pair.listing_id])
      }
    }

    return new StepResponse(pair, { ...pair, changed })
  },
  async (compensation, { container }) => {
    if (!compensation?.changed) return
    const listingService = container.resolve<any>("listing")
    if (compensation.action === "ARCHIVE") {
      await listingService.restoreListings([compensation.listing_id])
    } else {
      await listingService.softDeleteListings([compensation.listing_id])
    }
  }
)

export const updateProductArchiveStateStepId = "update-product-archive-state"
const updateProductArchiveStateStep = createStep(
  updateProductArchiveStateStepId,
  async (pair: ProductListingPair, { container }) => {
    const productService = container.resolve<any>(Modules.PRODUCT)
    const changed = pair.action === "ARCHIVE"
      ? !pair.product_deleted_at
      : Boolean(pair.product_deleted_at)

    if (changed) {
      if (pair.action === "ARCHIVE") {
        // This is a reversible archive. deleteProductsWorkflow also deletes
        // inventory links, so it is intentionally not used here.
        await productService.softDeleteProducts([pair.product_id])
      } else {
        await productService.restoreProducts([pair.product_id])
      }
    }

    return new StepResponse(pair, { ...pair, changed })
  },
  async (compensation, { container }) => {
    if (!compensation?.changed) return
    const productService = container.resolve<any>(Modules.PRODUCT)
    if (compensation.action === "ARCHIVE") {
      await productService.restoreProducts([compensation.product_id])
    } else {
      await productService.softDeleteProducts([compensation.product_id])
    }
  }
)

export const archiveProductMarketplaceWorkflowId = "archive-product-marketplace"
/**
 * Applies a reversible archive state to a Product and Listing as one Medusa
 * compensating workflow. Listing.product_id is never updated, preserving the
 * Seller mapping and lineage if either operation requires rollback.
 * See documentation/AI_CONTEXT.md §8.11.
 */
export const archiveProductMarketplaceWorkflow = createWorkflow(
  archiveProductMarketplaceWorkflowId,
  (input: ProductArchiveInput) => {
    const pair = resolveProductListingForArchiveStep(input)
    updateMarketplaceListingArchiveStateStep(pair)
    updateProductArchiveStateStep(pair)

    return new WorkflowResponse({
      product_id: pair.product_id,
      listing_id: pair.listing_id,
      archived: input.action === "ARCHIVE",
    })
  }
)
