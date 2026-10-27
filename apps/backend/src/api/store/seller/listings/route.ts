import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { randomUUID } from "node:crypto"

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
  if (!body.title?.trim() || body.price == null || !body.condition) return res.status(400).json({ message: "title, price and condition are required" })
  // Keep seller submissions one-of-one even if this route is called without
  // the shared middleware. See documentation/AI_CONTEXT.md §4.2 and §8.4.
  const options = Array.isArray(body.options) ? body.options : []
  const optionTitles = new Set<string>()
  if (options.some((option: any) => {
    const title = typeof option?.title === "string" ? option.title.trim().toLowerCase() : ""
    if (title && optionTitles.has(title)) return true
    if (title) optionTitles.add(title)
    return Array.isArray(option?.values) && option.values.length !== 1
  })) {
    return res.status(400).json({ message: "each product option must have exactly one value; a listing has one variant" })
  }
  const productService = req.scope.resolve<any>(Modules.PRODUCT)
  // Generate the celebrity SKU before product creation so the unique item can
  // be reconciled with Medusa inventory and the Listing after creation.
  // See documentation/AI_CONTEXT.md §4.2 and §8.4.
  const handle = body.handle?.trim() || `${body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`
  const shortId = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()
  const categoryPrefix = body.category_id?.includes("footwear") ? "FTW" : body.category_id?.includes("outerwear") ? "OUT" : "APP"
  const sku = `CELEB-${String(profile.handle).toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${categoryPrefix}-${shortId}`
  const optionInput = Array.isArray(body.options) && body.options.length
    ? Object.values((body.options as { title: string; value: string }[]).reduce((acc: Record<string, { title: string; values: string[] }>, option) => {
        if (!option?.title || !option?.value) return acc
        acc[option.title] ??= { title: option.title, values: [] }
        acc[option.title].values.push(option.value)
        return acc
      }, {}))
    : [{ title: "Item", values: ["Unique"] }]
  const variantOptions = Object.fromEntries((body.options ?? []).filter((option: any) => option?.title && option?.value).map((option: any) => [option.title, option.value]))
  const product = await productService.createProducts({
    title: body.title.trim(),
    handle,
    description: body.description?.trim(),
    status: "draft",
    category_ids: body.category_id ? [body.category_id] : undefined,
    collection_id: body.collection_id,
    options: optionInput,
    variants: [{ title: "Unique", sku, manage_inventory: true, inventory_quantity: 1, allow_backorder: false, options: Object.keys(variantOptions).length ? variantOptions : { Item: "Unique" }, prices: [{ amount: Math.round(Number(body.price) * 100), currency_code: body.currency_code ?? "usd" }] }],
    metadata: { images: body.images ?? [], seller_id: profile.id, seller_handle: profile.handle, seller_name: profile.store_name, category_id: body.category_id, collection_id: body.collection_id },
  })
  const listing = req.scope.resolve<any>("listing")
  const created = await listing.createListings({ seller_id: profile.id, product_id: product.id, listing_status: "PENDING_APPROVAL", listing_type: body.listing_type === "AUCTION" ? "AUCTION" : "FIXED_PRICE", item_condition: body.condition })
  res.status(201).json({ listing: created, product })
}
