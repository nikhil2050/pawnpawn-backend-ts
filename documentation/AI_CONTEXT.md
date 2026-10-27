# AI_CONTEXT.md - PawnPawn Backend (Medusa v2)

> **Purpose**: Complete project context for LLMs to understand the PawnPawn marketplace backend.
> **Location**: `/documentation/AI_CONTEXT.md`
> **Last Updated**: Oct 2026

> **Canonical marketplace architecture:** Read [the Marketplace Architecture Decision Record](./AI_CONTEXT.md#marketplace-architecture-decision-record) before changing seller, product, order, listing, lineage, inventory, or HQ fulfillment behavior. It records the resolved design questions from the architecture review.

> **Commit and explanation convention:** All generated git commits, code descriptions, and pull request summaries must use Conventional Commits: `<type>(<scope>): <short imperative description>`. Allowed types are `feat`, `fix`, `refactor`, `perf`, `docs`, and `chore`. Allowed PawnPawn scopes are `products`, `seller`, `listing`, `lineage`, `hq` (or `fulfillment`), `cart`, `auth`, `admin`, `db`, and `config`. See [`AGENTS.md`](./AGENTS.md#strict-commit-and-code-explanation-convention) for the full rule and examples.

---

## Agent mandate (compact source of truth)

Implement marketplace core features in `pawnpawn-backend-ts` with Medusa v2, PostgreSQL, and TypeScript.

1. Use native `ProductCategory` for taxonomies, `ProductCollection` for campaigns, and `ProductOption`/`ProductOptionValue` for attributes.
2. Sellers and buyers share Medusa `Customer`; each Seller links 1:1 through `customer_id`.
3. Use custom `seller`, `listing`, `lineage`, and `hq_fulfillment` modules via Medusa utils; never alter native product tables.
4. The `product.created` subscriber provisions Admin/API products: SKU `CELEB-[HANDLE]-[CAT_PREFIX]-[SHORT_UUID]`, `manage_inventory=true`, `allow_backorder=false`, quantity `1`, and an idempotent `PENDING_APPROVAL` Listing. Admin products use the system Seller fallback. Purchases set quantity to `0` while retaining SKU/history.
5. Listing lifecycle: `PENDING_APPROVAL` → `AVAILABLE` → `SOLD`; rejection returns feedback and resubmission resets pending.
6. Mixed carts create independent HQ fulfillment rows per order line: `WAITING_FOR_ARRIVAL` → `ARRIVED_AT_HQ` → `AUTHENTICATED_AND_PACKED` → `DISPATCHED` → `DELIVERED`.
7. MVP checkout is the placeholder `POST /store/purchase`; payout release follows delivery.
8. Commits and code explanations use `<type>(<scope>): <short imperative description>`. Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `chore`. Scopes: `products`, `seller`, `listing`, `lineage`, `hq`, `cart`, `auth`, `admin`, `db`, `config`.

## 1. 🎯 Project Overview

**PawnPawn** is a peer-to-peer marketplace platform where users can buy and sell second-hand items. The backend is built on **Medusa v2** (Node.js/TypeScript) and serves two frontend applications:
- **Buyer App** (`pawnpawn-frontend-buyer-ts`) - Next.js on `http://localhost:3000`
- **Seller App** (`pawnpawn-frontend-seller-ts`) - Next.js on `http://localhost:3001`

### 1.1 Key Business Concepts
| Concept | Description |
|---------|-------------|
| **Seller** | Marketplace vendor with verification status, Razorpay Connect account, trust level (`trusted`/`untrusted`), and category (`celebrity`, `influencer`, `musician`, `athlete`, `other`) |
| **Listing** | A seller's product listing with lifecycle (`PENDING_APPROVAL` → `AVAILABLE`/`SOLD`/`REJECTED`), `listing_type` (`FIXED_PRICE`/`AUCTION`), and condition |
| **Product** | Items listed for sale - either FIXED_PRICE or AUCTION |
| **Product Lineage** | Complete ownership chain: seller → buyer → buyer → ... |
| **HQ Fulfillment** | One record per purchased order line, progressing `WAITING_FOR_ARRIVAL` → `ARRIVED_AT_HQ` → `AUTHENTICATED_AND_PACKED` → `DISPATCHED` → `DELIVERED`, with authenticity certificate and payout release |
| **Purchase** | Transaction creating a lineage entry and transferring ownership (handled by the `order.placed` subscriber) |

---

## 2. 🏗️ Architecture

### 2.1 Tech Stack
```
├── Runtime: Node.js ≥ 22.22.0 required (current shell: v22.14.0; v24.15.0 available via nvm)
├── Framework: Medusa v2.22.0 (@medusajs/medusa)
├── Language: TypeScript 5.6+
├── Database: PostgreSQL 15+ (local instance: pawnpawn_db)
├── ORM: Medusa's internal (MikroORM-based)
├── Package Manager: npm 11.12.1 (Turborepo workspace)
└── Monorepo: Turborepo (root: /PawnPawnTS)
```

## 3. 📁 Directory Structure

```
/Users/nikhilkshirsagar/AdvancedComputing/NKProjects/PawnPawnTS/
└── Projects/
    └── pawnpawn-backend-ts/
        ├── documentation/
        │   ├── README.md              # Documentation index + current status
        │   ├── AGENTS.md              # Medusa agent instructions
        │   ├── AI_CONTEXT.md          # This file
        │   ├── API.md                 # OpenAPI spec + endpoint documentation
        │   ├── CLAUDE.md              # Claude config (reads AGENTS.md)
        │   ├── LOCAL_DEPLOYMENT.md    # Local deploy & test guide
        │   ├── POSTGRESQL_COMMANDS.md # PostgreSQL command reference
        │   ├── SAMPLE_DATA.md         # Seeded celebrity sellers, buyers, listings, lineage
        │   └── DB_MIGRATE_WORKAROUND.md # Workaround for defineConfig/migration scripts issue
        ├── apps/
        │   └── backend/
        │       ├── medusa-config.js   # Main config (DB, CORS, modules) - .js NOT .ts
        │       ├── .env               # Local env (gitignored, copy from .env.example)
        │       ├── .env.example       # Environment template
        │       ├── package.json       # Scripts & dependencies
        │       ├── sql/
        │       │   ├── schema.sql     # Custom DDL: seller, lineage, listing and HQ fulfillment
        │       │   ├── sample-data.sql # Idempotent demo seed (sellers, listings, lineage)
        │       │   └── marketplace_prompt_alignment.sql # Prompt-alignment data migration
        │       ├── src/
        │       │   ├── modules/
        │       │   │   ├── seller/
        │       │   │   │   ├── index.ts         # Module("seller", { service: SellerModuleService })
        │       │   │   │   ├── models/seller.ts # Seller data model
        │       │   │   │   └── service.ts       # SellerModuleService (findByHandle, verifySeller, updateRazorpayAccount, findTrustedSellers, findSellersByCategory, updateTrustStatus, updateCategory, updateSocialMedia, updateBio)
        │       │   │   ├── lineage/
        │       │   │   │   ├── index.ts         # Module("lineage", { service: LineageModuleService })
        │       │   │   │   ├── models/product-lineage.ts  # ProductLineage data model
        │       │   │   │   └── service.ts       # LineageModuleService (recordTransfer, getLineageHistory, getCurrentOwner)
        │       │   │   ├── listing/
        │       │   │   │   ├── index.ts         # Module("listing", { service: ListingModuleService })
        │       │   │   │   ├── models/listing.ts # Listing data model
        │       │   │   │   └── service.ts       # ListingModuleService (reviewListing)
        │       │   │   └── hq-fulfillment/
        │       │   │       ├── index.ts         # Module("hq_fulfillment", { service: HqFulfillmentModuleService })
        │       │   │       ├── models/hq-fulfillment.ts  # HqFulfillment data model
        │       │   │       └── service.ts       # HqFulfillmentModuleService
        │       │   ├── scripts/
        │       │   │   ├── import-sql.ts        # SQL runner (npm run db:import)
        │       │   │   └── verify-sample-data.ts # Round-trip seller/lineage verification
        │       │   ├── api/
        │       │   │   ├── store/custom/route.ts # Placeholder only (no PawnPawn store routes yet)
        │       │   │   ├── store/seller/onboard/route.ts          # POST /store/seller/onboard
        │       │   │   ├── store/sellers/[handle]/route.ts        # GET /store/sellers/:handle
        │       │   │   ├── store/seller/listings/route.ts         # GET/POST /store/seller/listings
        │       │   │   ├── store/seller/products/route.ts         # POST /store/seller/products alias
        │       │   │   ├── store/seller/listings/[id]/route.ts    # PATCH /store/seller/listings/:id
        │       │   │   ├── admin/custom/route.ts # Placeholder only
        │       │   │   ├── admin/seller/route.ts # GET/POST /admin/seller
        │       │   │   ├── admin/seller/[id]/route.ts # GET/PATCH/DELETE /admin/seller/:id
        │       │   │   ├── admin/seller/[id]/listings/route.ts # GET /admin/seller/:id/listings
        │       │   │   ├── admin/listings/route.ts # GET /admin/listings
        │       │   │   ├── admin/listings/[id]/review/route.ts # POST /admin/listings/:id/review
        │       │   │   ├── admin/hq-fulfillments/[id]/route.ts # POST /admin/hq-fulfillments/:id
        │       │   │   └── middlewares.ts       # Store search + customer auth (configureStoreSearch, authenticate)
        │       │   ├── admin/
        │       │   │   └── routes/sellers/page.tsx # Sellers page in Medusa Admin (/app/sellers)
        │       │   ├── jobs/                    # Scheduled jobs
        │       │   ├── links/                   # Module links
        │       │   ├── search/                  # Product search index definition
        │       │   ├── subscribers/             # product.created marketplace provisioning; order.placed -> HQ fulfillment + lineage
        │       │   └── workflows/               # Business logic workflows
        │       ├── README.md                    # Medusa default
        │       └── node_modules/                # Installed (1362 packages)
```

---

## 4. 🗄️ Database Schema

### 4.1 Marketplace architecture summary

Seller identity is a Medusa Customer identity plus one Seller profile. Product ownership is normalized in the Listing module (`seller_id` + `product_id`), while product metadata keeps seller display fields for compatibility. Listings move through `PENDING_APPROVAL → AVAILABLE → SOLD` or `REJECTED`; seller edits resubmit a rejected listing. Mixed-seller carts are supported, so HQ fulfillment is per order line. Payout release occurs after delivery. See the [Marketplace Architecture Decision Record](./AI_CONTEXT.md#marketplace-architecture-decision-record) for the full decision record and follow-up work.

### 4.2 Prompt-aligned implementation rules

<!-- This section records the implementation constraints introduced by the
     marketplace alignment work so future agents preserve the same boundaries.
     It is the canonical reference for the changes described below. -->

- Medusa owns `ProductCategory`, `ProductCollection`, `ProductOption`, and `ProductOptionValue`. Seed data uses native fashion categories (`Apparel`, `Outerwear`, `Footwear`) and the `Karan Johar Fall Drop` collection.
- Seller, Listing, ProductLineage, and HQFulfillment are custom modules registered in `medusa-config.js`. Listing is the seller-to-product source of truth; Medusa `product` is not extended with marketplace ownership columns.
- The authenticated seller listing route resolves the active Seller profile from the customer session, then uses Medusa's `createProductsWorkflow` to create a draft product with native category/collection/options. The `product.created` subscriber provisions every product created through either the Seller API or native Admin UI: it assigns or repairs standardized variant SKUs, enables one-of-one inventory, and creates an idempotent linked `PENDING_APPROVAL` Listing. Seller metadata chooses the Listing seller; Admin-created products fall back to the `system` Seller and `CELEB-SYSTEM-GEN-[SHORT_UUID]` SKU pattern. The Seller route is available at `POST /store/seller/products`; `POST /store/seller/listings` remains an alias.
- Admin product creation derives the Handle from Title as lowercase words joined with hyphens. Hyphens are removed from the Title input and rejected by the Admin/Seller product middleware; generated handles are the only place this separator is introduced.
- Product creation checks the normalized handle against Medusa products in the backend. If it already exists, the request is rewritten to the next available suffix (`handle-2`, `handle-3`, ...), and the Admin success toast displays the final handle returned by Medusa.
- Product-creation middleware enforces one value per option type for Admin and Seller creation. Adding an existing Admin option such as Size, Colour, or Authenticity starts with no value selected; the admin must choose one. The form reduces any retained legacy selection to its latest value, and choosing another value replaces the prior choice. The option value field uses the neutral localized `Select` placeholder rather than Medusa's colour-specific `Red, Blue, Green` example. The startup patch updates the Dashboard package and Medusa's generated `.medusa` Admin asset, adds a new route-asset URL to avoid browser reuse of the prior bundle, and clears the disposable Vite dependency cache so `/app/entry.jsx` is rebuilt from the corrected code. Repeating an option title or submitting an option `values` array with more than one value returns `400`, preserving the one-physical-item, one-variant model.
- Admin review accepts `APPROVE`, `EDIT_AND_APPROVE`, and `REJECT` from any non-sold state. Approval makes the Listing `AVAILABLE` and publishes its product; rejection makes it `REJECTED`, drafts its product, and records the reviewer and latest feedback. Legacy `RETURN` resets a non-sold Listing to `PENDING_APPROVAL` and drafts its product. Seller edits also resubmit to `PENDING_APPROVAL`. The API is implemented; a dedicated Admin review page is still pending.
- Sold unique items retain product, SKU, Listing, lineage, and HQ records; inventory becomes zero. Mixed carts create one HQ row per order line and payout release is gated by `DELIVERED`.

### 4.3 Current database alignment (local `pawnpawn_db`)

Applied with `sql/marketplace_prompt_alignment.sql`:

| Entity | Current data |
|---|---:|
| Sellers | 8 |
| Products | 17 (13 marketplace products, 4 draft Medusa demos) |
| Listings | 13, all currently `AVAILABLE` |
| Marketplace inventory | 13 unique variants, one stocked unit each |
| Native fashion categories | Apparel, Outerwear, Footwear |
| Native campaign collection | Karan Johar Fall Drop |
| Native marketplace options | Size and Condition |

The migration canonicalizes marketplace SKUs, attaches native option values, assigns the fall-drop collection to selected listings, and adds `listing.admin_feedback`. Existing celebrity fixture sellers without `customer_id` are catalog fixtures; production onboarding must create or link the Medusa Customer identity first.

### 4.4 Feature implementation checklist

Status values: **Implemented** = available in the repository and local database; **Partial** = core path exists but an adapter, UI, or production hardening remains; **Planned** = documented contract with no complete implementation.

#### 4.4.1 Identity and seller profiles

- [x] **Implemented** — Medusa Customer is the shared buyer/seller identity.
- [x] **Implemented** — Seller profile stores handle, store name, avatar, verification, trust, category, social handle, biography, and Razorpay account reference.
- [x] **Implemented** — Seller IDs are retained as opaque text/UUID-shaped strings and are never regenerated during updates.
- [x] **Implemented** — Seller inactivation uses `is_deactivated`; seller rows and history are retained.
- [ ] **Partial** — Existing celebrity fixture sellers need real `customer_id` links before they can authenticate through the seller portal.
- [x] **Implemented** — Active seller authorization scopes seller listing reads and writes to the authenticated customer.

#### 4.4.2 Native catalog and item modeling

- [x] **Implemented** — Medusa Product remains the catalog and commerce primitive.
- [x] **Implemented** — Native ProductCategory is used for Apparel, Outerwear, and Footwear.
- [x] **Implemented** — Native ProductCollection is used for the Karan Johar Fall Drop campaign.
- [x] **Implemented** — Native ProductOption/ProductOptionValue stores Size and Condition values.
- [x] **Implemented** — Marketplace products carry seller display metadata for compatibility/search presentation.
- [x] **Implemented** — Marketplace product schemas are not extended with seller ownership or listing lifecycle columns.
- [x] **Implemented** — Marketplace variants use `manage_inventory = true`, `allow_backorder = false`, and one initial unit.
- [x] **Implemented** — Marketplace SKUs follow `CELEB-[HANDLE]-[CAT_PREFIX]-[SHORT_UUID]`.
- [x] **Implemented** — The `product.created` subscriber applies SKU, inventory, seller metadata, and `PENDING_APPROVAL` Listing defaults to Admin and Seller product creation. It is idempotent and logs provisioning failures without failing the originating product request.

#### 4.4.3 Listing lifecycle and seller onboarding

- [x] **Implemented** — Listing module links one current seller to one Medusa product.
- [x] **Implemented** — Seller can create a draft listing through `POST /store/seller/products` or the `/store/seller/listings` alias.
- [x] **Implemented** — New listings start as `PENDING_APPROVAL` and remain hidden from the public catalog.
- [x] **Implemented** — Seller can list and update only their own listings.
- [x] **Implemented** — Rejected listings can be edited and resubmitted for review.
- [x] **Implemented** — Listing status supports `PENDING_APPROVAL`, `AVAILABLE`, `SOLD`, and `REJECTED`.
- [x] **Implemented** — Listing type supports `FIXED_PRICE` and `AUCTION` at the module level.
- [x] **Partial** — Auction bidding and auction settlement endpoints are not implemented.

#### 4.4.4 Administrative review and inspection

- [x] **Implemented** — Admin can approve a listing with `APPROVE`.
- [x] **Implemented** — Admin can edit product data and approve with `EDIT_AND_APPROVE`.
- [x] **Implemented** — Admin can reject/return a listing with feedback using `REJECT` or legacy `RETURN`.
- [x] **Implemented** — Admin can re-review any non-sold Listing: approve a rejected Listing, reject an available Listing, or return it to `PENDING_APPROVAL`.
- [x] **Implemented** — Reviewer, review timestamp, rejection feedback, and admin feedback are stored.
- [ ] **Partial** — A dedicated append-only review audit table/event log is still recommended for multiple decisions per listing.
- [x] **Implemented** — Admin listing endpoints expose seller/listing relationships and lifecycle data.
- [ ] **Partial** — A complete Admin UI for listing review, buyer/order details, and HQ state is still pending.

#### 4.4.5 Buyer storefront and search

- [x] **Implemented** — Public seller profiles return active seller information and available inventory.
- [x] **Partial** — Product visibility is controlled through Listing status in custom seller/profile routes; the core Medusa `/store/products` route still needs a Listing-aware filter middleware/serializer.
- [x] **Implemented** — Native category, collection, and option values are present for storefront filtering/search indexing.
- [ ] **Planned** — A dedicated `GET /store/products` marketplace serializer with explicit `AVAILABLE` filtering and seller fields.
- [ ] **Partial** — Seller profile route returns active available inventory; a dedicated public sold-archive response is still pending.

#### 4.4.6 Checkout, inventory, lineage, and resale

- [x] **Implemented** — `order.placed` resolves listings per order line, supporting mixed-seller carts.
- [x] **Implemented** — Purchased listings transition to `SOLD` and remain retained for audit/history.
- [x] **Implemented** — Product lineage records seller, buyer, price, and transaction time.
- [x] **Implemented** — Resale can change the current Listing seller while lineage preserves prior ownership.
- [x] **Partial** — Inventory quantity is seeded and normalized to one; atomic reservation/decrement during payment capture needs production checkout workflow hardening.
- [ ] **Planned** — Dedicated `POST /store/purchase` orchestration with payment capture and idempotency.
- [ ] **Planned** — Dedicated product lineage REST endpoints for buyers and admins.

#### 4.4.7 HQ fulfillment and payouts

- [x] **Implemented** — HQ fulfillment is modeled per order line/listing, not per order.
- [x] **Implemented** — HQ states progress through `WAITING_FOR_ARRIVAL`, `ARRIVED_AT_HQ`, `AUTHENTICATED_AND_PACKED`, `DISPATCHED`, and `DELIVERED`.
- [x] **Implemented** — Admin HQ transition route validates and updates fulfillment records.
- [x] **Partial** — Certificate URL storage exists; certificate generation and document storage adapters are not connected.
- [x] **Partial** — Delivery-gated payout timestamp/state exists in HQ data; Razorpay Route release and idempotency adapter are not connected.
- [ ] **Planned** — Returns, disputes, failed authentication, and payout reversal workflows.

#### 4.4.8 Modules, routes, and operations

- [x] **Implemented** — Seller, Listing, Lineage, and HQ Fulfillment custom modules are registered in `medusa-config.js`.
- [x] **Implemented** — Seller, listing, admin review, seller profile, and HQ route handlers exist.
- [x] **Implemented** — Idempotent SQL schema and prompt-alignment migration are available for local setup.
- [x] **Implemented** — Sample sellers, products, listings, inventory, options, categories, collections, and lineage are populated locally.
- [ ] **Partial** — Automated integration coverage for seller isolation, mixed carts, review audit, resale, delivery, and payout release remains to be added.
- [ ] **Planned** — Production observability, webhook reconciliation, and background retry jobs for payment/HQ/payout adapters.

<a id="marketplace-architecture-decision-record"></a>
## 5. Marketplace Architecture Decision Record

PawnPawn is a hub-and-spoke celebrity-to-fan marketplace. Celebrities submit unique memorabilia, admins review it, fans purchase it, and every sold item travels through PawnPawn HQ for authenticity checks, certificate generation, repackaging, and dispatch.

### 5.1 Decisions from architecture review

- A celebrity seller uses the same Medusa Customer identity as a buyer. A Customer can have at most one Seller profile and can still purchase as a fan.
- A seller can own many products. The normalized relationship is `listing.seller_id -> listing.product_id`; product metadata fields `seller_id`, `seller_handle`, and `seller_name` are denormalized compatibility fields.
- The Listing module owns marketplace state: `PENDING_APPROVAL`, `AVAILABLE`, `SOLD`, or `REJECTED`. Medusa Product remains the commerce/catalog primitive.
- Seller reassignment on resale changes the current Listing seller. `product_lineage` preserves the original seller and every prior owner.
- Rejection is decided per listing. An admin may return an item with feedback for seller edits, or correct the listing and approve it. Both actions must be auditable.
- One buyer cart may contain products from multiple sellers. HQ fulfillment is therefore one record per order line/listing, never one record per order.
- HQ state progresses through `WAITING_FOR_ARRIVAL`, `ARRIVED_AT_HQ`, `AUTHENTICATED_AND_PACKED`, `DISPATCHED`, and `DELIVERED`.
- Seller payout is released after buyer delivery. Payment capture, payout, and dispute handling remain separate from listing approval.
- Inactivation sets `seller.is_deactivated = true`; it never permanently deletes a seller.

### 5.2 Questions resolved during review

| Question | Decision |
|---|---|
| Should a seller use a separate identity? | No. Use the same Medusa Customer identity so a celebrity can also buy as a fan. |
| What happens when a listing is rejected? | The seller may edit and resubmit; an admin may also correct it before approval. The decision is per listing and auditable. |
| Should seller assignment live in product metadata, product columns, or a module? | Use a dedicated Listing module; metadata is only denormalized display/search data. |
| Can a buyer purchase from multiple celebrities in one cart? | Yes. Track HQ fulfillment independently per order line/listing. |
| When is payout released? | After buyer delivery, with a future Razorpay adapter and idempotency protection. |
| Should inactivation delete seller records? | No. Set `is_deactivated` and retain the seller, listings, and history. |

### 5.3 Data ownership

| Concern | Source of truth |
|---|---|
| Seller profile and verification | Seller module |
| Product title, variants, prices, inventory | Medusa Product/Inventory modules |
| Seller-to-product assignment and approval | Listing module |
| Prior ownership and resale history | Product Lineage module |
| HQ receipt, authentication, dispatch | HQ Fulfillment module |
| Buyer, order, payment, delivery | Medusa Customer/Order/Fulfillment modules |

### 5.4 Implemented backend surface

- Seller: `POST /store/seller/onboard`, `GET/POST /store/seller/listings`, `POST /store/seller/products`, `PATCH /store/seller/listings/:id`.
- Public seller: `GET /store/sellers/:handle`.
- Admin listings: `GET /admin/listings`, `POST /admin/listings/:id/review`, `GET /admin/seller/:id/listings`.
- HQ operations: `POST /admin/hq-fulfillments/:id` with `MARK_RECEIVED`, `AUTHENTICATE_AND_PACK`, `DISPATCH`, or `MARK_DELIVERED`.
- `order.placed` creates HQ records, marks matching available items sold, and records lineage.

### 5.5 Known follow-up work

- Wire the separate buyer and seller Next.js applications to these APIs.
- Add a dedicated Admin listings/product view with seller, buyer, listing state, and HQ state.
- Replace the payout timestamp with a Razorpay payout adapter and idempotency keys.
- Add certificate generation/storage and delivery, return, and dispute workflows.
- Add integration tests for seller authorization, mixed-seller carts, listing review, HQ transitions, and payout release.

### 5.6 Custom Tables (Defined in `sql/schema.sql`)

#### 5.6.1 `seller` Table
```sql
CREATE TABLE seller (
    id TEXT PRIMARY KEY,
    customer_id VARCHAR(255),                -- optional link to a Medusa customer
    handle VARCHAR(100) NOT NULL UNIQUE,
    store_name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    razorpay_account_id VARCHAR(100) UNIQUE,
    seller_trust VARCHAR(20) NOT NULL DEFAULT 'trusted',
    seller_category VARCHAR(50) NOT NULL DEFAULT 'celebrity',
    social_media_handle VARCHAR(255),
    bio TEXT,
    verification_status seller_verification_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```
**Indexes**: `handle`, `razorpay_account_id`, `verification_status`, `seller_trust`, `seller_category`, `customer_id` (unique, partial)

#### 5.6.2 `product_lineage` Table
```sql
CREATE TABLE product_lineage (
    id TEXT PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL,
    seller_id TEXT REFERENCES seller(id),    -- nullable: buyer-to-buyer resale
    buyer_id VARCHAR(100),
    price DECIMAL(12, 2) NOT NULL,
    transacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```
**Indexes**: `product_id`, `seller_id`, `buyer_id`, `transacted_at`

> IDs are `TEXT`, not `UUID`, because Medusa generates text IDs. Treat them as opaque: service-created rows get ULID-like values, while seed rows may use `seller_*` / `lineage_*` or UUID-shaped text depending on when the DB was first seeded. `created_at`, `updated_at`, and `deleted_at` are required by Medusa's generated service queries.

#### 5.6.3 `listing` Table

Marketplace listing lifecycle. Product data stays managed by Medusa; this table owns seller assignment, review state and marketplace-only attributes.

```sql
CREATE TABLE listing (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL REFERENCES seller(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL UNIQUE REFERENCES product(id) ON DELETE RESTRICT,
    listing_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
      CHECK (listing_status IN ('PENDING_APPROVAL', 'AVAILABLE', 'SOLD', 'REJECTED')),
    listing_type TEXT NOT NULL DEFAULT 'FIXED_PRICE'
      CHECK (listing_type IN ('FIXED_PRICE', 'AUCTION')),
    item_condition TEXT,
    rejection_feedback TEXT,
    admin_feedback TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_listing_seller_status ON listing(seller_id, listing_status);
```

#### 5.6.4 `hq_fulfillment` Table

One HQ record per purchased order line so mixed-seller carts can progress independently through authentication, delivery and payout release.

```sql
CREATE TABLE hq_fulfillment (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    order_line_item_id TEXT NOT NULL UNIQUE,
    listing_id TEXT NOT NULL REFERENCES listing(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
    seller_id TEXT NOT NULL REFERENCES seller(id) ON DELETE RESTRICT,
    buyer_id TEXT,
    hq_status TEXT NOT NULL DEFAULT 'WAITING_FOR_ARRIVAL'
      CHECK (hq_status IN ('WAITING_FOR_ARRIVAL', 'ARRIVED_AT_HQ', 'AUTHENTICATED_AND_PACKED', 'DISPATCHED', 'DELIVERED')),
    certificate_url TEXT,
    payout_released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_hq_fulfillment_seller_status ON hq_fulfillment(seller_id, hq_status);
```

### 5.7 Enums
| Enum Name | Values | Used By |
|-----------|--------|---------|
| `seller_verification_status` | `PENDING`, `VERIFIED` | `seller.verification_status` |
| `listing_status` | `PENDING_APPROVAL`, `AVAILABLE`, `SOLD`, `REJECTED` | `listing.listing_status` |
| `hq_status` | `WAITING_FOR_ARRIVAL`, `ARRIVED_AT_HQ`, `AUTHENTICATED_AND_PACKED`, `DISPATCHED`, `DELIVERED` | `hq_fulfillment.hq_status` |

> `seller.seller_trust`, `seller.seller_category`, and `listing.listing_type` are **VARCHAR with defaults**, not PostgreSQL enums, so new values can be added without a migration. Application-level values are documented in `SAMPLE_DATA.md`.

### 5.8 Helper Views
| View | Purpose |
|------|---------|
| `product_current_owner` | Latest owner of each product (from lineage) |
| `seller_stats` | Aggregated sales count, revenue, last sale per seller |

---

## 6. ⚙️ Configuration

### 6.1 Configuration File: `medusa-config.js` (NOT `.ts`)

**Important**: Medusa CLI's ts-node has ESM/CJS interop issues with `defineConfig()` imports from `@medusajs/framework/utils`. The config uses plain `module.exports` with all core modules registered manually.

```javascript
const dotenv = require('dotenv')
dotenv.config({ path: require('path').resolve(process.cwd(), '.env') })

module.exports = {
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/pawnpawn_db',
    http: {
      storeCors: process.env.STORE_CORS || 'http://localhost:3000,http://localhost:3001',
      adminCors: process.env.ADMIN_CORS || 'http://localhost:9000,http://localhost:5173',
      authCors: process.env.AUTH_CORS || 'http://localhost:3000,http://localhost:3001,http://localhost:9000',
      jwtSecret: process.env.JWT_SECRET || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
    databaseLogging: process.env.NODE_ENV === 'development',
    workerMode: process.env.MEDUSA_WORKER_MODE || 'shared',
  },
  admin: {
    disable: false,
    path: '/app',
    autoRebuild: true,
    serve: true,
  },
  featureFlags: {
    product_categories_v2: true,
  },
  modules: {
    // All default core modules registered manually:
    auth: { resolve: '@medusajs/medusa/auth', options: { providers: [{ resolve: '@medusajs/medusa/auth-emailpass', id: 'emailpass' }] } },
    user: { resolve: '@medusajs/medusa/user', options: { jwt_secret: process.env.JWT_SECRET || 'supersecret' } },
    api_key: { resolve: '@medusajs/medusa/api-key' },
    store: { resolve: '@medusajs/medusa/store' },
    stock_location: { resolve: '@medusajs/medusa/stock-location' },
    inventory: { resolve: '@medusajs/medusa/inventory' },
    product: { resolve: '@medusajs/medusa/product' },
    pricing: { resolve: '@medusajs/medusa/pricing' },
    promotion: { resolve: '@medusajs/medusa/promotion' },
    customer: { resolve: '@medusajs/medusa/customer' },
    sales_channel: { resolve: '@medusajs/medusa/sales-channel' },
    cart: { resolve: '@medusajs/medusa/cart' },
    region: { resolve: '@medusajs/medusa/region' },
    tax: { resolve: '@medusajs/medusa/tax' },
    currency: { resolve: '@medusajs/medusa/currency' },
    payment: { resolve: '@medusajs/medusa/payment' },
    order: { resolve: '@medusajs/medusa/order' },
    settings: { resolve: '@medusajs/medusa/settings' },
    fulfillment: { resolve: '@medusajs/medusa/fulfillment', options: { providers: [{ resolve: '@medusajs/medusa/fulfillment-manual', id: 'manual' }] } },
    notification: { resolve: '@medusajs/medusa/notification', options: { providers: [{ resolve: '@medusajs/medusa/notification-local', id: 'local', options: { name: 'Local Notification Provider', channels: ['feed'] }] } } },
    search: { resolve: '@medusajs/medusa/search', options: { providers: [{ resolve: '@medusajs/medusa/search-postgres', id: 'postgres', options: { engine: 'native' } }] } },
    cache: { resolve: '@medusajs/medusa/cache-inmemory' },
    event_bus: { resolve: '@medusajs/medusa/event-bus-local' },
    locking: { resolve: '@medusajs/medusa/locking' },
    file: { resolve: '@medusajs/medusa/file', options: { providers: [{ resolve: '@medusajs/medusa/file-local', id: 'local' }] } },
    // Custom PawnPawn modules:
    seller: { resolve: './src/modules/seller' },
    lineage: { resolve: './src/modules/lineage' },
    listing: { resolve: './src/modules/listing' },
    hq_fulfillment: { resolve: './src/modules/hq-fulfillment' },
  },
}
```

**Intentionally excluded modules:** `rbac` and `workflow-engine-inmemory` are not registered — enabling them causes license/shared-container failures in this setup. Registering modules as an array or with hyphenated keys also breaks loading; `modules` must be an object keyed by valid names (`api_key`, `seller`, `lineage`, `listing`, `hq_fulfillment`, ...).

<a id="custom-marketplace-module-registry-and-verification"></a>
#### 6.1.1 Custom marketplace module registry and verification

| Logical module | Module directory | `medusa-config.js` key | Container resolution key | Backing table | Status |
|---|---|---|---|---|---|
| SellerModule | `src/modules/seller` | `seller` | `seller` | `seller` | Registered and verified |
| ListingModule | `src/modules/listing` | `listing` | `listing` | `listing` | Registered and verified |
| LineageModule | `src/modules/lineage` | `lineage` | `lineage` | `product_lineage` | Registered and verified |
| HQFulfillmentModule | `src/modules/hq-fulfillment` | `hq_fulfillment` | `hq_fulfillment` | `hq_fulfillment` | Registered and verified |

`FulfillmentHQ` in marketplace terminology maps to `HQFulfillmentModule` in code. The `hq_fulfillment` key uses underscores because it is a Medusa dependency-injection name; the filesystem directory uses `hq-fulfillment`.

Run the verification after schema import and seed setup:

```bash
cd apps/backend
../../node_modules/.bin/medusa exec ./src/scripts/verify-sample-data.ts
```

The script resolves all four module keys and reads Listing/HQ rows through generated Medusa service methods. It also runs the existing temporary Seller and Lineage CRUD checks, then removes those temporary records.

### 6.2 Environment Variables (`.env`)
```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pawnpawn_db
STORE_CORS=http://localhost:3000,http://localhost:3001
ADMIN_CORS=http://localhost:9000,http://localhost:5173
AUTH_CORS=http://localhost:3000,http://localhost:3001,http://localhost:9000
JWT_SECRET=supersecret
COOKIE_SECRET=supersecret
NODE_ENV=development
```

### 6.3 CORS Strategy
| Origin | Purpose | Credentials |
|--------|---------|-------------|
| `http://localhost:3000` | Buyer App | ✅ Yes |
| `http://localhost:3001` | Seller App | ✅ Yes |
| `http://localhost:9000` | Medusa Admin | ✅ Yes |
| `http://localhost:5173` | Vite dev (admin) | ✅ Yes |

### 6.4 Local Runtime Details (verified)

| Item | Value |
|------|-------|
| Backend URL | `http://localhost:9000` |
| Admin UI | `http://localhost:9000/app` |
| Admin sellers page | `http://localhost:9000/app/sellers` |
| Database | `pawnpawn_db` on `localhost:5432` (user/pass `postgres`) |
| Node | current shell `v22.14.0`; `v24.15.0` also installed via nvm |
| npm | `11.12.1` |
| Publishable key | `pk_a6c505481cec4bc82dd9cfcbee017cac5ca0affd31ae65ee78861dcd46bc30e4` |
| US region | `reg_01M5SSC7P6CPJDG955B1564RQT` (`usd`) |
| India region | `reg_01M5SGFGPPFNFBFRJQAAHRRNVA` (`inr`) |
| Europe region | `reg_01M5J0TH63KAP4HJN34ERGDC5N` (`eur`) |
| Default sales channel | `sc_01M5J0TH4TCBFJ4NJD3T1TEZZ2` |
| Sample buyers | 5 accounts, password `buyer1234` (see `SAMPLE_DATA.md`) |

> The 13 seeded PawnPawn listings have USD and INR prices only (the 4 Medusa demo products include EUR). Querying a seeded listing with the Europe region returns no `calculated_price` until EUR prices are added.

Start / stop:

```bash
cd apps/backend
../../node_modules/.bin/medusa develop     # or: cd ../.. && npm run backend:dev
pkill -f "medusa develop"                  # stop
lsof -ti:9000 | xargs kill -9              # if port is stuck
```

---

## 7. 📦 Package Scripts

From `apps/backend/`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Medusa dev server (`medusa develop`) |
| `npm run start` | Start production server (`medusa start`) |
| `npm run build` | Build for production (`medusa build`) |
| `npm run lint` | Run ESLint with Medusa rules |
| `npm run db:import` | Execute `sql/schema.sql` via `ts-node` |

From the project root:

| Command | Description |
|---------|-------------|
| `npm run backend:dev` | Start only the backend via Turbo |
| `npm run dev` | Start all workspace apps via Turbo |
| `npm run build` | Build all apps |

Seed helper commands (from `apps/backend/`):

```bash
psql -h localhost -U postgres -d pawnpawn_db -f sql/sample-data.sql
../../node_modules/.bin/medusa exec ./src/scripts/verify-sample-data.ts
```

### 7.1 Database Commands (via Medusa CLI)
Run from `apps/backend/` directory:

```bash
# Run Medusa migrations (schema only; migration scripts may fail non-fatally)
../../node_modules/.bin/medusa db:migrate

# Import custom SQL schema
npm run db:import

# Admin user already exists; only run this if starting from an empty DB
../../node_modules/.bin/medusa user -e admin@pawnpawn.com -p supersecret

# Run custom scripts
../../node_modules/.bin/medusa exec ./src/scripts/seed-demo-products.ts
../../node_modules/.bin/medusa exec ./src/scripts/verify-sample-data.ts

# Load PawnPawn sample data (8 sellers, 5 buyers, 13 seller-mapped listings, inventory, lineage)
psql -h localhost -U postgres -d pawnpawn_db -v ON_ERROR_STOP=1 -f sql/sample-data.sql
```

**Sample data**: see `documentation/SAMPLE_DATA.md`. Buyer accounts use password `buyer1234`; the store API key is `pk_a6c505481cec4bc82dd9cfcbee017cac5ca0affd31ae65ee78861dcd46bc30e4`.

**Note**: `db:migrate` schema step succeeds ("Database already up-to-date"). Migration scripts step fails with `Cannot read properties of undefined (reading 'acquire')` — this is non-fatal. See `documentation/DB_MIGRATE_WORKAROUND.md`.

---

## 8. 🔄 Core Workflows

> **Status note:** Medusa core routes and the custom module services exist. Admin seller CRUD (`GET/POST /admin/seller`, `GET/PATCH/DELETE /admin/seller/:id`), admin listing review, HQ fulfillment transitions, seller onboarding, seller listings, and the **Sellers** admin page are implemented. `PATCH /store/seller/me`, custom `POST/PATCH /store/products`, auctions, `/store/purchase`, `/store/products/:id/lineage`, and `/admin/lineage*` remain planned. See `API.md` → Current Implementation Status.

### 8.1 Admin Login (Implemented)
```
POST /auth/user/emailpass
  → Body: { email: "admin@pawnpawn.com", password: "supersecret" }
  → Returns: JWT token
  → Use: Authorization: Bearer <token>
```

### 8.2 Buyer Registration & Login (Implemented)
```
POST /auth/customer/emailpass/register  → auth identity + token
POST /store/customers                   → customer profile (needs publishable key)
POST /auth/customer/emailpass           → login, returns token
```

### 8.3 Seller Onboarding (Implemented)
```
IMPLEMENTED: POST /store/seller/onboard
  → Requires authenticated customer (Bearer/session)
  → Body: { handle, store_name, avatar_url? }
  → Creates a seller row (trust=untrusted, category=other, verification=PENDING)
  → 409 if a seller profile already exists for this customer
  → 401 if not authenticated

CURRENT: sellerService.createSellers({ handle, store_name, razorpay_account_id, ... })
```

### 8.4 Product Listing (Implemented via seller listings)
```
IMPLEMENTED: GET /store/products, GET /store/products/:id (Medusa core)
IMPLEMENTED: GET /store/sellers/:handle (public seller profile + available products)
IMPLEMENTED: GET/POST /store/seller/listings and POST /store/seller/products (seller listing CRUD)
IMPLEMENTED: PATCH /store/seller/listings/:id (own listings only)
IMPLEMENTED: product.created subscriber (SKU, one-unit inventory, seller fallback, and Listing provisioning for Seller/Admin product creation)
IMPLEMENTED: GET /admin/listings, POST /admin/listings/:id/review (admin review)
PLANNED:     POST/PATCH /store/products, auction start/bid
```

### 8.5 Purchase Flow (Planned REST; subscriber handles orders)
```
PLANNED: POST /store/purchase
  → would create order + product_lineage entry

CURRENT: order.placed subscriber (src/subscribers/order-placed-hq-fulfillment.ts)
  → marks listing SOLD, creates hq_fulfillment per line item, records lineage
CURRENT: lineageService.recordTransfer({ product_id, seller_id?, buyer_id, price })
```

### 8.6 Lineage Query (Planned REST — module/SQL works)
```
PLANNED: GET /store/products/:id/lineage

CURRENT: lineageService.getLineageHistory(productId)
         lineageService.getCurrentOwner(productId)
```

### 8.7 Admin Seller Listing (Implemented)

```
IMPLEMENTED: GET /admin/seller           → list/filter sellers (Bearer admin token)
IMPLEMENTED: GET /admin/seller/:id       → seller detail
IMPLEMENTED: POST /admin/seller          → create seller
IMPLEMENTED: PATCH /admin/seller/:id     → update any seller field
IMPLEMENTED: DELETE /admin/seller/:id    → soft-deactivate (is_deactivated = true)
IMPLEMENTED: Admin UI /app/sellers       → Sellers sidebar page

Query params: q, trust (trusted|untrusted), category, status (active|inactive), limit (1-100), offset
DATA: sellerService.listAndCountSellers(filters, { take, skip, order })
UI:  apps/backend/src/admin/routes/sellers/page.tsx
API: apps/backend/src/api/admin/seller/route.ts
     apps/backend/src/api/admin/seller/[id]/route.ts

PLANNED: /admin/lineage*
```

---

## 9. 🔐 Authentication

### 9.1 Admin Login (Working)
```bash
curl -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pawnpawn.com","password":"supersecret"}'
```

Returns a JWT token. Use it with:
```bash
Authorization: Bearer <jwt_token>
```

### 9.2 Admin Credentials
| Field | Value |
|-------|-------|
| Email | `admin@pawnpawn.com` |
| Password | `supersecret` |

> **Note**: Admin user already exists in DB (seeded during migration). Password was updated via direct SQL update to `provider_identity.provider_metadata.password`.

### 9.3 Store API Authentication
- Header: `x-publishable-api-key: <token>` (get from `api_key` table)
- Or: `Authorization: Bearer <jwt_token>`

### 9.4 Sample Buyer Credentials
All sample buyers use password `buyer1234`. See `SAMPLE_DATA.md`.

---

## 10. 📡 API Endpoints

**Status legend:** `Implemented` = route exists and was exercised; `Planned` = contract only, no route file.

### 10.1 Auth
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| POST | `/auth/user/emailpass` | No | Admin login | Implemented |
| POST | `/auth/session` | Bearer | Create session from JWT | Implemented |
| GET | `/auth/user/providers` | Bearer | List auth providers | Implemented |
| POST | `/auth/customer/emailpass` | No | Buyer login | Implemented |
| POST | `/auth/customer/emailpass/register` | No | Buyer registration | Implemented |

### 10.2 Seller
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| POST | `/store/seller/onboard` | Bearer/Cookie (customer) | Onboard authenticated customer as seller | Implemented |
| GET | `/store/sellers/:handle` | No | Public seller profile + available products | Implemented |
| GET | `/store/seller/listings` | Bearer/Cookie (customer) | Authenticated seller's listings | Implemented |
| POST | `/store/seller/listings` / `/store/seller/products` | Bearer/Cookie (customer) | Create a listing (draft product + Listing) | Implemented |
| PATCH | `/store/seller/listings/:id` | Bearer/Cookie (customer) | Update own listing | Implemented |
| GET | `/store/seller/me` | Bearer/Cookie | Get current seller profile | Planned |
| PATCH | `/store/seller/me` | Bearer/Cookie | Update seller profile | Planned |

### 10.3 Listings & HQ Fulfillment
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| GET | `/admin/listings` | Bearer | List all listings (with seller/product) | Implemented |
| POST | `/admin/listings/:id/review` | Bearer | Approve, edit-and-approve, or reject a listing | Implemented |
| GET | `/admin/seller/:id/listings` | Bearer | Listings + HQ fulfillments for a seller | Implemented |
| POST | `/admin/hq-fulfillments/:id` | Bearer | Advance an HQ fulfillment lifecycle | Implemented |

### 10.4 Products
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| GET | `/store/products` | Publishable key | List products | Implemented (core) |
| GET | `/store/products/:id` | Publishable key | Get product | Implemented (core) |
| POST | `/store/products` | Bearer/Cookie | Create listing | Planned |
| PATCH | `/store/products/:id` | Bearer/Cookie | Update listing | Planned |
| POST | `/store/products/:id/auction/start` | Bearer/Cookie | Start auction | Planned |
| POST | `/store/products/:id/bid` | Bearer/Cookie | Place bid on auction | Planned |

### 10.5 Purchase/Lineage
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| POST | `/store/purchase` | Bearer/Cookie | Purchase product | Planned |
| GET | `/store/products/:id/lineage` | No | Ownership history | Planned |

### 10.6 Custom Module Admin REST
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| GET | `/admin/seller` | Bearer | List/filter sellers | Implemented |
| GET | `/admin/seller/:id` | Bearer | Seller detail | Implemented |
| POST | `/admin/seller` | Bearer | Create seller | Implemented |
| PATCH | `/admin/seller/:id` | Bearer | Update any seller field | Implemented |
| DELETE | `/admin/seller/:id` | Bearer | Deactivate seller (soft-delete) | Implemented |
| GET | `/admin/listings` | Bearer | List all listings | Implemented |
| POST | `/admin/listings/:id/review` | Bearer | Approve, edit-and-approve, or reject a listing | Implemented |
| GET | `/admin/seller/:id/listings` | Bearer | Listings + fulfillments for a seller | Implemented |
| POST | `/admin/hq-fulfillments/:id` | Bearer | Advance HQ fulfillment | Implemented |
| GET/POST | `/admin/lineage`, `/admin/lineage/:id` | Bearer | Lineage CRUD | Planned |

### 10.7 Admin UI
| Route | Description | Status |
|-------|-------------|--------|
| `/app/sellers` | Sellers list page (store, handle, category, trust, verification, bio, social, customer link) | Implemented |

### 10.8 Custom Module Service Access (Implemented)

```ts
const sellerService = container.resolve("seller")     // not "sellerModuleService"
const lineageService = container.resolve("lineage")   // not "lineageModuleService"
const listingService = container.resolve("listing")
const hqFulfillmentService = container.resolve("hq_fulfillment")
```

Seller methods: `findByHandle`, `verifySeller`, `updateRazorpayAccount`, `findTrustedSellers`, `findSellersByCategory`, `updateTrustStatus`, `updateCategory`, `updateSocialMedia`, `updateBio`.

Lineage methods: `recordTransfer`, `getLineageHistory`, `getCurrentOwner`.

Listing methods: `reviewListing(id, status, userId, feedback?)`.

Generated CRUD: `listSellers` / `createSellers` / `updateSellers` / `deleteSellers`; `listProductLineages` / `createProductLineages` / `updateProductLineages` / `deleteProductLineages`; `listListings` / `retrieveListing` / `createListings` / `updateListings` / `deleteListings`; `listHqFulfillments` / `retrieveHqFulfillment` / `createHqFulfillments` / `updateHqFulfillments` / `deleteHqFulfillments`.

> `MedusaService` has no generic `this.list()` / `this.update()`. `updateSellers` takes `{ id, ...fields }` or `{ selector, data }`.

---

## 11. 🧪 Testing Strategy

- **Unit tests**: `src/**/__tests__/**/*.unit.spec.ts` → `npm run test:unit`
- **Module integration**: `src/modules/*/__tests__/**` → `npm run test:integration:modules`
- **HTTP integration**: `integration-tests/http/*.spec.ts` → `npm run test:integration:http`

---

## 12. 🚀 Quick Start Checklist

1. Start PostgreSQL: `pg_isready -h localhost -p 5432`
2. Create DB: `createdb -h localhost -U postgres pawnpawn_db`
3. Copy env: `cp .env.example .env`
4. Run migrations: `../../node_modules/.bin/medusa db:migrate` (ignore migration scripts error)
5. Import custom schema: `npm run db:import`
6. Seed sample data: `psql -h localhost -U postgres -d pawnpawn_db -f sql/sample-data.sql`
7. Start server: `../../node_modules/.bin/medusa develop`
8. Test health: `curl http://localhost:9000/health`
9. Verify modules: `../../node_modules/.bin/medusa exec ./src/scripts/verify-sample-data.ts`
10. Admin login: `POST /auth/user/emailpass` with `admin@pawnpawn.com` / `supersecret`
11. Admin sellers: `GET /admin/seller` with the admin token returns 8 sellers; open `http://localhost:9000/app/sellers`
12. Buyer login: `POST /auth/customer/emailpass` with `sarah.johnson@gmail.com` / `buyer1234`
13. Onboard a seller: `POST /store/seller/onboard` with a customer token
14. Create a listing: `POST /store/seller/listings` with a seller token
15. Review a listing: `POST /admin/listings/:id/review` with an admin token
16. Advance HQ fulfillment: `POST /admin/hq-fulfillments/:id` with an admin token

---

## 13. 📚 References

- [Medusa v2 Documentation](https://docs.medusajs.com)
- [Medusa Framework API](https://docs.medusajs.com/resources/framework)
- [Core Flows Reference](https://docs.medusajs.com/resources/core-flows)
- [Module Development Guide](https://docs.medusajs.com/modules)
- [Workflow Development](https://docs.medusajs.com/workflows)
- [Razorpay Connect Docs](https://razorpay.com/docs/connect/)

---

*Last sync: Oct 2026 — Medusa v2.22.0, seller/lineage/listing/HQ modules implemented, sample data seeded (8 sellers / 5 buyers / 17 products / 13 listings / 13 unique marketplace inventory units / 8 lineage records), schema aligned to text IDs + Medusa timestamps, admin seller CRUD API + Sellers page implemented.*
