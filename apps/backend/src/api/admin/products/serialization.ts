const isPricingField = (field: string) =>
  field.startsWith("variants.prices") || field.startsWith("*variants.prices")

export const remapAdminProductFields = (fields: string[]) => [
  ...fields.filter((field) => !isPricingField(field)),
  ...fields
    .filter((field) => isPricingField(field))
    .map((field) => field.replace("variants.prices.", "variants.price_set.prices.")),
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

export const serializeAdminProduct = (product: any) => ({
  ...product,
  variants: product.variants?.map(remapVariant),
})
