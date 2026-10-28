# Custom subscribers

Subscribers maintain cross-module marketplace synchronization described in the [Marketplace Architecture Decision Record](../../../../documentation/AI_CONTEXT.md#marketplace-architecture-decision-record), including product-created marketplace provisioning, seller metadata sync, and order-to-HQ creation.

`product-created.ts` listens for `product.created` from the Seller API and native Admin UI. It repairs or assigns standardized SKUs, enables one-of-one inventory, provisions a `PENDING_APPROVAL` Listing, and falls back to the `system` Seller when product metadata has no Seller context. It is idempotent so it can safely run alongside the Seller listing route.

`order-placed-hq-fulfillment.ts` listens for `order.placed` and exports the same
`processOrderPlaced` handler used by the dummy `POST /store/purchase` route. For
each order line it marks the Listing `SOLD`, sets all linked inventory levels to
zero, drafts the native product, creates one `WAITING_FOR_ARRIVAL` HQ record,
and records seller-to-buyer lineage. The source order-line ID is the lineage
retry key, so an event retry is safe while a later resale to the same buyer is
still recorded.

`product-deleted.ts` listens for `product.deleted` and soft-deletes the linked
Listing only while the Product remains soft-deleted. It first reloads the Product
with deleted records included, so a queued stale event cannot archive a Listing
after an Admin restore. The Admin archive route uses one compensating Medusa
workflow for Product and Listing, retaining ownership, inventory links, and
lineage.

Subscribers handle events emitted in the Medusa application.

> Learn more about Subscribers in [this documentation](https://docs.medusajs.com/learn/fundamentals/events-and-subscribers).

The subscriber is created in a TypeScript or JavaScript file under the `src/subscribers` directory.

For example, create the file `src/subscribers/product-created.ts` with the following content:

```ts
import {
  type SubscriberConfig,
} from "@medusajs/framework"

// subscriber function
export default async function productCreateHandler() {
  console.log("A product was created")
}

// subscriber config
export const config: SubscriberConfig = {
  event: "product.created",
}
```

A subscriber file must export:

- The subscriber function that is an asynchronous function executed whenever the associated event is triggered.
- A configuration object defining the event this subscriber is listening to.

## Subscriber Parameters

A subscriber receives an object having the following properties:

- `event`: An object holding the event's details. It has a `data` property, which is the event's data payload.
- `container`: The Medusa container. Use it to resolve modules' main services and other registered resources.

```ts
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

export default async function productCreateHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = data.id

  const productModuleService = container.resolve("product")

  const product = await productModuleService.retrieveProduct(productId)

  console.log(`The product ${product.title} was created`)
}

export const config: SubscriberConfig = {
  event: "product.created",
}
```
