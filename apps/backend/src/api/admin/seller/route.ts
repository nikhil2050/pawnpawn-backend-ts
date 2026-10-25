import { randomUUID } from "node:crypto"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { SellerModuleService } from "../../../modules/seller"

type SellerListQuery = {
  q?: string
  trust?: "trusted" | "untrusted"
  category?: string
  limit?: string
  offset?: string
  status?: "active" | "inactive"
}

const isTrust = (value?: string): value is "trusted" | "untrusted" =>
  value === "trusted" || value === "untrusted"

/**
 * GET /admin/seller
 *
 * Lists marketplace sellers with optional search and filters.
 * Query params: q, trust, category, limit, offset
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerService: SellerModuleService = req.scope.resolve("seller")
  const query = req.query as SellerListQuery

  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100)
  const offset = Math.max(Number(query.offset) || 0, 0)

  const filters: Record<string, unknown> = {}

  if (isTrust(query.trust)) {
    filters.seller_trust = query.trust
  }

  if (query.category) {
    filters.seller_category = query.category
  }

  if (query.status === "active") filters.is_deactivated = false
  if (query.status === "inactive") filters.is_deactivated = true

  const q = query.q?.trim()
  if (q) {
    filters.$or = [
      { handle: { $ilike: `%${q}%` } },
      { store_name: { $ilike: `%${q}%` } },
      { social_media_handle: { $ilike: `%${q}%` } },
    ]
  }

  const [sellers, count] = await sellerService.listAndCountSellers(filters, {
    take: limit,
    skip: offset,
    order: { store_name: "ASC" },
  })

  res.json({
    sellers,
    count,
    limit,
    offset,
  })
}

type SellerInput = {
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

const sellerFields = (body: SellerInput) => ({
  id: randomUUID(),
  handle: body.handle?.trim(),
  store_name: body.store_name?.trim(),
  avatar_url: body.avatar_url?.trim() || null,
  razorpay_account_id: body.razorpay_account_id?.trim() || null,
  seller_trust: body.seller_trust,
  seller_category: body.seller_category,
  social_media_handle: body.social_media_handle?.trim() || null,
  bio: body.bio?.trim() || null,
  verification_status: body.verification_status,
  is_deactivated: body.is_deactivated ?? false,
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const sellerService: SellerModuleService = req.scope.resolve("seller")
  const body = req.body as SellerInput

  if (!body.handle?.trim() || !body.store_name?.trim()) {
    return res.status(400).json({ message: "handle and store_name are required" })
  }

  const seller = await sellerService.createSellers(sellerFields(body))
  return res.status(201).json({ seller })
}
