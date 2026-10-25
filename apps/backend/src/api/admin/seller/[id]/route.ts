import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { SellerModuleService } from "../../../../modules/seller"

/**
 * GET /admin/seller/:id
 *
 * Returns a single seller by its text ID.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerService: SellerModuleService = req.scope.resolve("seller")
  const { id } = req.params

  const seller = await sellerService.retrieveSeller(id).catch(() => null)

  if (!seller) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Seller with id "${id}" was not found`
    )
  }

  res.json({ seller })
}

type SellerUpdate = {
  handle?: string
  store_name?: string
  avatar_url?: string | null
  razorpay_account_id?: string | null
  seller_trust?: "trusted" | "untrusted"
  seller_category?: "celebrity" | "influencer" | "musician" | "athlete" | "other"
  social_media_handle?: string | null
  bio?: string | null
  verification_status?: "PENDING" | "VERIFIED"
  is_deactivated?: boolean
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const sellerService: SellerModuleService = req.scope.resolve("seller")
  const { id } = req.params
  const body = req.body as SellerUpdate
  const seller = await sellerService.updateSellers({
    id,
    ...body,
    handle: body.handle?.trim(),
    store_name: body.store_name?.trim(),
    avatar_url: body.avatar_url?.trim() || null,
    razorpay_account_id: body.razorpay_account_id?.trim() || null,
    social_media_handle: body.social_media_handle?.trim() || null,
    bio: body.bio?.trim() || null,
  })

  return res.json({ seller })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const sellerService: SellerModuleService = req.scope.resolve("seller")
  const seller = await sellerService.updateSellers({
    id: req.params.id,
    is_deactivated: true,
  })
  return res.json({ seller })
}
