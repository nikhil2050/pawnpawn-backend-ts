# Admin Customizations

Marketplace-specific Admin behavior follows the [Marketplace Architecture Decision Record](../../../../documentation/AI_CONTEXT.md#marketplace-architecture-decision-record); seller/listing review and HQ inspection are separate from generic Medusa widgets.

## PawnPawn Admin surfaces

- `/app/products` is the unified catalog and moderation screen. It shows Product, Seller, Collection, SKU, Inventory, and Listing Status, with lifecycle and Archived filters; it never reads product metadata for ownership.
- `/app/products/:id` includes the **Marketplace & Seller Governance** detail widget for Seller reassignment, inline review, archive, and restore actions. It is in the main product-details zone, has no separate commerce drawer or Seller action button, and can be dragged to the top with Admin **Customize layout**.
- `/app/listings` is a compatibility redirect to `/app/products`; it has no independent Admin screen.
- `/app/sellers?q=<handle>` filters the Seller page for links from product mapping surfaces.

The native Medusa Products table does not expose a public column-extension API. `scripts/patch-medusa-dashboard-single-option.cjs` applies a version-checked Dashboard patch before development, start, and install; keep that patch aligned with the installed Dashboard version.

You can extend the Medusa Admin to add widgets and new pages. Your customizations interact with API routes to provide merchants with custom functionalities.

> Learn more about Admin Extensions in [this documentation](https://docs.medusajs.com/learn/fundamentals/admin).

## Example: Create a Widget

A widget is a React component that can be injected into an existing page in the admin dashboard.

For example, create the file `src/admin/widgets/product-widget.tsx` with the following content:

```tsx title="src/admin/widgets/product-widget.tsx"
import { defineWidgetConfig } from "@medusajs/admin-sdk"

// The widget
const ProductWidget = () => {
  return (
    <div>
      <h2>Product Widget</h2>
    </div>
  )
}

// The widget's configurations
export const config = defineWidgetConfig({
  zone: "product.details",
})

export default ProductWidget
```

This inserts a widget with the text “Product Widget” at the end of a product’s details page.
