import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"

type VariantPrice = {
  amount: number
  currency_code: string
}

type ProductVariant = {
  id: string
  title: string | null
  sku: string | null
  inventory_quantity: number | null
  prices?: VariantPrice[]
}

type ProductVariantsResponse = {
  product: { variants: ProductVariant[] }
}

const fetchVariants = async (productId: string): Promise<ProductVariantsResponse> => {
  const response = await fetch(
    `/admin/products/${productId}?fields=variants.id,variants.title,variants.sku,variants.inventory_quantity,variants.prices`,
    { credentials: "include" }
  )
  if (!response.ok) throw new Error("Unable to load product variants")
  return response.json()
}

const formatPrice = (price?: VariantPrice) => {
  if (!price) return "—"
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: price.currency_code.toUpperCase(),
  }).format(Number(price.amount) / 100)
}

/**
 * Displays native Medusa Variant commerce fields beside the marketplace
 * governance widget. SKU and inventory remain owned by ProductVariant.
 * See documentation/AI_CONTEXT.md §8.11.
 */
const ProductVariantCommerce = ({ data }: { data: { id: string } }) => {
  const variantsQuery = useQuery({
    queryKey: ["product-variant-commerce", data.id],
    queryFn: () => fetchVariants(data.id),
  })

  const variants = variantsQuery.data?.product.variants ?? []

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Variants</Heading>
      </div>
      {variantsQuery.isLoading && <Text size="small" className="px-6 py-4">Loading variants…</Text>}
      {variantsQuery.isError && <Text size="small" className="px-6 py-4 text-ui-fg-error">Unable to load variants.</Text>}
      {!variantsQuery.isLoading && !variantsQuery.isError && variants.length === 0 && (
        <Text size="small" className="px-6 py-4 text-ui-fg-subtle">No variants found.</Text>
      )}
      {variants.map((variant) => (
        <div key={variant.id} className="grid grid-cols-1 gap-3 px-6 py-4 sm:grid-cols-4">
          <div>
            <Text size="small" className="text-ui-fg-subtle">Variant</Text>
            <Text size="small">{variant.title || "Default"}</Text>
          </div>
          <div>
            <Text size="small" className="text-ui-fg-subtle">SKU</Text>
            <Text size="small">{variant.sku || "—"}</Text>
          </div>
          <div>
            <Text size="small" className="text-ui-fg-subtle">Price</Text>
            <Text size="small">{formatPrice(variant.prices?.[0])}</Text>
          </div>
          <div>
            <Text size="small" className="text-ui-fg-subtle">Inventory</Text>
            <Text size="small">{variant.inventory_quantity ?? "—"}</Text>
          </div>
        </div>
      ))}
    </Container>
  )
}

export const config = defineWidgetConfig({
  id: "pawnpawn.product-variant-commerce",
  zone: "product.details",
})

export default ProductVariantCommerce
