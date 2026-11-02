import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export type CalculatedRegionalPrice = {
  calculated_amount: number
  currency_code: string
}

/**
 * Uses Medusa Price Sets and Pricing rules instead of product metadata. A
 * missing or zero amount is deliberately omitted so public catalog callers
 * cannot advertise an instant-buy item in an unavailable region.
 * See documentation/AI_CONTEXT.md §8.9.
 */
export const calculateRegionalVariantPrices = async (
  container: any,
  variantIds: string[],
  region: { id: string; currency_code: string }
) => {
  if (!variantIds.length) return new Map<string, CalculatedRegionalPrice>()
  const link = container.resolve(ContainerRegistrationKeys.LINK) as any
  const pricing = container.resolve(Modules.PRICING) as any
  const productPricingLink = link.getLinkModule(
    Modules.PRODUCT,
    "variant_id",
    Modules.PRICING,
    "price_set_id"
  )
  const links = await productPricingLink.list(
    { variant_id: variantIds },
    { select: ["variant_id", "price_set_id"] }
  )
  if (!links.length) return new Map<string, CalculatedRegionalPrice>()

  const calculated = await pricing.calculatePrices(
    { id: links.map((entry: any) => entry.price_set_id) },
    { context: { currency_code: region.currency_code, region_id: region.id, quantity: 1 } }
  )
  const priceBySet = new Map<string, any>((calculated as any[]).map((price) => [price.id, price]))
  const result = new Map<string, CalculatedRegionalPrice>()
  for (const entry of links) {
    const price = priceBySet.get(entry.price_set_id)
    const amount = Number(price?.calculated_amount)
    if (Number.isFinite(amount) && amount > 0) {
      result.set(entry.variant_id, { calculated_amount: amount, currency_code: region.currency_code })
    }
  }
  return result
}
