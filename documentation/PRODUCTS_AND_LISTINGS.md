# Products and Listings

This document explains the difference between Medusa Products and PawnPawn Listings for reviewers and contributors.

## Products screen (`/app/products`)

The Products screen is Medusa's native catalog management area. Each row represents a Medusa `Product`, which owns the commercial catalog data:

- title, handle, description, thumbnail, and images;
- categories and collections;
- options and the single allowed value for each option;
- variant SKU, prices, and inventory configuration; and
- the native draft or published state.

PawnPawn adds **Seller**, **SKU**, **Inventory**, and **Listing Status** to the table. The order is Product, Seller, Collection, SKU, Inventory, Listing Status, then the remaining native columns. The status filters at the top include All, Pending Approval, Available, Sold, Rejected, and Archived. The displayed Seller and status are resolved from the normalized marketplace relationship:

```text
Product.id -> Listing.product_id -> Listing.seller_id -> Seller
```

The Product detail screen includes a **Marketplace & Seller Governance** detail widget. An admin can see the mapped Seller, current marketplace status, latest feedback, and reviewer name resolved from Medusa's User module; reassign the Seller; review inline with Approve, Edit & approve, Reject, or Return to pending approval; and archive or restore an item. Reassignment updates `listing.seller_id`; it does not update Product metadata. The widget uses the main `product.details` zone and can be moved to the top with Admin **Customize layout**.

### Marketplace status hierarchy

The unified Products UI uses the following visual priority:

- 🟡 `PENDING_APPROVAL` — requires administrator review.
- 🟢 `AVAILABLE` — active on the public storefront.
- 🔵 `SOLD` — retained for audit and lineage.
- 🔴 `REJECTED` — hidden with feedback retained.
- 🔘 `INACTIVE` — the native Product is soft-deleted (`deleted_at IS NOT NULL`).

Archived items are isolated behind the **Archived** filter and can be restored from the inline governance controls. Marketplace status, Seller mapping, reviewer, feedback, reassignment, moderation, and archive/restore actions are displayed directly in the widget; there is no separate commerce drawer or Seller navigation button.

Use the Products screen when changing the item itself: title, price, photos, category, collection, options, SKU, or inventory.

## Listings route (`/app/listings`)

The independent Listings screen has been deprecated. `/app/listings` now redirects to `/app/products`, where all Listing moderation is available alongside the associated Medusa Product.

A Listing owns marketplace-specific data that Medusa Product does not own:

- current Seller assignment (`seller_id`);
- marketplace lifecycle status;
- listing type;
- administrator feedback;
- reviewer and review timestamp; and
- approval or rejection context.

The Listing lifecycle is:

```text
PENDING_APPROVAL -> AVAILABLE -> SOLD
       |
       -> REJECTED
```

- `PENDING_APPROVAL`: the item awaits review and is hidden from the buyer catalog.
- `AVAILABLE`: the item is approved and visible in the buyer storefront catalog.
- `REJECTED`: the item is hidden and retains administrator feedback. Seller edits can resubmit it as `PENDING_APPROVAL`.
- `SOLD`: the item was purchased and remains retained for lineage and fulfillment history.

Use the Products screen when reviewing marketplace eligibility: approve, reject, inspect Seller ownership, inspect Listing status, or manage archived items. Review actions call `POST /admin/listings/:id/review`.

## Why Products and Listings both exist

The separate Listings **screen** is deprecated, but the Listing remains the marketplace record that the unified Products screen reads and manages.

| Concern | Product | Listing |
|---|---|---|
| Native Medusa catalog data | Owns it | References it |
| Seller ownership | Displays the resolved Seller | Source of truth |
| Categories, collections, and options | Owns them | Does not duplicate them |
| Price, SKU, and inventory | Owns them | Uses them during marketplace lifecycle |
| Marketplace approval | Does not own it | Owns it |
| Buyer storefront visibility | Returned only when its Listing is `AVAILABLE` | Controls eligibility |
| Seller reassignment | Provides the detail-page entry point | Persists `seller_id` |
| Purchase history and provenance | Remains permanent | Links to lineage and HQ fulfillment |

The architecture keeps Medusa's Product schema unchanged. `listing.product_id` and `listing.seller_id` are the authoritative marketplace relationship; Product metadata is not used for ownership.

## UX operating principles

- Keep Commercial Attributes (price, SKU, inventory) visually separate from Governance Actions (seller reassignment, status, feedback, and review) in the Product detail panel.
- Use the same status colors everywhere: 🟡 Pending approval, 🟢 Available, 🔵 Sold, 🔴 Rejected, and 🔘 Inactive.
- The buyer frontend should present lineage as an Ownership Chain and explain per-item shipping and HQ authentication for mixed-seller carts.
- The seller frontend should validate category, condition, and pricing immediately during listing submission.
