const isPricingField = (field: string) =>
  field.startsWith("variants.prices") || field.startsWith("*variants.prices")

const requiredVariantFields = [
  "variants.id",
  "variants.sku",
  "variants.inventory_quantity",
]

/**
 * The native Admin list query excludes variants by default. Marketplace
 * product views need the native Variant fields below for SKU and inventory;
 * no Product schema fields are added. See AI_CONTEXT.md §8.11.
 */
export const remapAdminProductFields = (fields: string[]) => [
  ...new Set([
    ...fields
      .filter((field) => field !== "-variants" && !isPricingField(field)),
    ...fields
      .filter((field) => isPricingField(field))
      .map((field) => field.replace("variants.prices.", "variants.price_set.prices.")),
    ...requiredVariantFields,
  ]),
]

const remapVariant = (variant: any) => {
  if (!variant) return variant
  const result = { ...variant }
  if (variant.price_set?.prices) {
    result.prices = variant.price_set.prices.map((price: any) => ({
      id: price.id,
      amount: price.amount,
      currency_code: price.currency_code,
      min_quantity: price.min_quantity,
      max_quantity: price.max_quantity,
      variant_id: variant.id,
      created_at: price.created_at,
      updated_at: price.updated_at,
      rules: Object.fromEntries(
        (price.price_rules ?? [])
          .filter((rule: any) => rule.attribute)
          .map((rule: any) => [rule.attribute, rule.value])
      ),
    }))
    delete result.price_set
  }
  return result
}

const summarizeVariantSkus = (variants: any[]) => {
  const skus = variants
    .map((variant) => variant.sku)
    .filter((sku): sku is string => typeof sku === "string" && Boolean(sku.trim()))

  return {
    primary_sku: skus[0] ?? null,
    additional_count: Math.max(0, variants.length - 1),
    values: skus,
  }
}

export const serializeAdminProduct = (product: any) => {
  const variants = product.variants?.map(remapVariant) ?? []
  return {
    ...product,
    variants,
    // A read-only projection for list clients. Variant remains the native SKU
    // owner; this avoids adding a denormalized Product SKU column.
    marketplace_skus: summarizeVariantSkus(variants),
  }
}
