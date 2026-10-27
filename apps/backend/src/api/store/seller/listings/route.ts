import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

const currentSeller = async (req: MedusaRequest) => {
  const seller = req.scope.resolve<any>("seller")
  const [profile] = await seller.listSellers({ customer_id: (req as any).auth_context?.actor_id, is_deactivated: false }, { take: 1 })
  return profile
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const profile = await currentSeller(req)
  if (!profile) return res.status(403).json({ message: "An active seller profile is required" })
  const listing = req.scope.resolve<any>("listing")
  const listings = await listing.listListings({ seller_id: profile.id })
  res.json({ listings })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const profile = await currentSeller(req)
  if (!profile) return res.status(403).json({ message: "An active seller profile is required" })
  const body = req.body as any
  if (!body.title?.trim() || !body.price || !body.condition) return res.status(400).json({ message: "title, price and condition are required" })
  const productService = req.scope.resolve<any>(Modules.PRODUCT)
  const handle = body.handle?.trim() || `${body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`
  const product = await productService.createProducts({ title: body.title.trim(), handle, description: body.description?.trim(), status: "draft", options: [{ title: "Item", values: ["Unique"] }], variants: [{ title: "Unique", manage_inventory: true, allow_backorder: false, options: { Item: "Unique" }, prices: [{ amount: Math.round(Number(body.price) * 100), currency_code: body.currency_code ?? "usd" }] }], metadata: { images: body.images ?? [] } })
  const listing = req.scope.resolve<any>("listing")
  const created = await listing.createListings({ seller_id: profile.id, product_id: product.id, listing_status: "PENDING_APPROVAL", listing_type: body.listing_type === "AUCTION" ? "AUCTION" : "FIXED_PRICE", item_condition: body.condition })
  res.status(201).json({ listing: created, product })
}
