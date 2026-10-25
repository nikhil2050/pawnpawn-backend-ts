import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { SellerModuleService } from "../../../modules/seller"

type SellerListQuery = {
  q?: string
  trust?: "trusted" | "untrusted"
  category?: string
  limit?: string
  offset?: string
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
