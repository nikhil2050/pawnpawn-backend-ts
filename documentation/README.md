# PawnPawn Backend Documentation

Index for all project documentation. The backend is a Medusa v2.22.0 service in `apps/backend/`, seeded with celebrity-memorabilia demo data.

## Document Map

| Document | Read it for |
|----------|-------------|
| [`AI_CONTEXT.md`](./AI_CONTEXT.md) | Architecture, directory layout, schema, config, module services, workflows |
| [`API.md`](./API.md) | OpenAPI spec, endpoint summary, implementation status, request/response examples |
| [`PRODUCTS_AND_LISTINGS.md`](./PRODUCTS_AND_LISTINGS.md) | Difference between the native Products screen and PawnPawn Listings moderation screen |
| [`LOCAL_DEPLOYMENT.md`](./LOCAL_DEPLOYMENT.md) | Prerequisites, setup, seeding, start/stop, endpoint testing |
| [`SAMPLE_DATA.md`](./SAMPLE_DATA.md) | Seeded sellers, buyers, products, lineage, credentials, verification |
| [`POSTGRESQL_COMMANDS.md`](./POSTGRESQL_COMMANDS.md) | SQL cheat sheet for seller, lineage, and product operations |
| [`DB_MIGRATE_WORKAROUND.md`](./DB_MIGRATE_WORKAROUND.md) | Why `medusa-config.js` is plain CJS and how to migrate/import schema |
| [`AGENTS.md`](./AGENTS.md) | Agent/contributor rules, conventions, common mistakes, off-limits paths |
| [`CLAUDE.md`](./CLAUDE.md) | Pointer to `AGENTS.md` |
| [`AI_CONTEXT.md`](./AI_CONTEXT.md#marketplace-architecture-decision-record) | Resolved celebrity-to-fan workflow, data ownership, APIs, and follow-up decisions |

## Current Status (Oct 2026)

<!-- Keep this snapshot aligned with the prompt-alignment migration and route
     aliases so contributors know which local data and APIs are available. See
     AI_CONTEXT.md §4.3 and §10. -->

- Medusa core routes work: auth (`/auth/*`), store catalog (`GET /store/products`), store customers, admin core.
- Custom modules work: `container.resolve("seller")`, `container.resolve("lineage")`, `container.resolve("listing")`, `container.resolve("hq_fulfillment")`.
- Seller data is fully manageable through the admin API (`GET/POST /admin/seller`, `GET/PATCH/DELETE /admin/seller/:id`) and a **Sellers** page at `http://localhost:9000/app/sellers`.
- Seller onboarding, seller listing CRUD, filtered admin Listing review, strict per-line HQ fulfillment transitions, and line-item exceptions are implemented (`POST /store/seller/onboard`, `GET/POST /store/seller/listings`, `POST /store/seller/products`, `PATCH /store/seller/listings/:id`, `GET /store/sellers/:handle`, `GET /admin/listings?status=&seller_id=`, `POST /admin/listings/:id/review`, `GET /admin/seller/:id/listings`, `POST /admin/hq-fulfillments/:id`, `POST /admin/hq-fulfillments/:id/exception`). `/app/products` is the unified Seller, Listing, and catalog moderation screen, including lifecycle filters, archive visibility, native Variant SKU summaries, and inline review/reassignment. Product detail has a Variant SKU, price, and inventory widget. Product archive/restore uses a compensating workflow that preserves `listing.product_id` and inventory links; the `product.deleted` subscriber ignores stale events after a restore. `/app/listings` redirects to Products. Review can re-moderate any non-sold Listing: approve to `AVAILABLE`, reject to `REJECTED` and draft its product, or return it to `PENDING_APPROVAL`.
- Custom storefront routes include an AVAILABLE-only `GET /store/products` catalog with native taxonomy/option filters, public seller inventory/archive at `GET /store/sellers/:handle`, authenticated seller profile management at `GET/PATCH /store/seller/me`, and public ownership provenance at `GET /store/products/:id/lineage`. Admins can inspect full dispute provenance with `GET /admin/lineage/:product_id`. Custom `POST/PATCH /store/products`, auctions, and Admin lineage collection/mutation routes remain planned. The dummy purchase route `POST /store/purchase` is implemented. See [`API.md`](./API.md#current-implementation-status).
- Product creation normalizes handles server-side and allocates `-2`, `-3`, and later suffixes for duplicates. Admin product creation enforces one selected value per option and shows the final persisted handle in the success notification.
- The `product.created` subscriber applies marketplace defaults to Seller and Admin products: standard SKU, one-unit inventory, and an idempotent `PENDING_APPROVAL` Listing. Admin products without seller metadata use the system Seller.
- The Admin Dashboard startup patch is idempotent: it injects the Products Seller, SKU, Inventory, and Listing Status columns without modifying Medusa core tables. If a stale Vite bundle reports `Importing a module script failed`, restart `medusa develop` so the corrected bundle is rebuilt.
- The canonical sample seed defines 8 sellers, 5 buyers, 17 products (13 marketplace products), native fashion taxonomy/options, and 8 lineage records. Runtime data is mutable; use the verification commands in `SAMPLE_DATA.md` instead of treating those counts as the current local database state.

## Quick Start

```bash
cd apps/backend

# Schema + sample data
npm run db:import
psql -h localhost -U postgres -d pawnpawn_db -v ON_ERROR_STOP=1 -f sql/sample-data.sql
psql -h localhost -U postgres -d pawnpawn_db -v ON_ERROR_STOP=1 -f sql/marketplace_prompt_alignment.sql

# Verify custom modules
../../node_modules/.bin/medusa exec ./src/scripts/verify-sample-data.ts

# Run the server
../../node_modules/.bin/medusa develop
```

`npm run develop` is not defined. From `apps/backend`, use `npm run dev` (or
the direct Medusa command above). From the repository root, use
`npm run backend:dev`; if it says `turbo: command not found`, run `npm install`
at the repository root first. If port 9000 is already occupied, stop the
existing process with `pkill -f "medusa develop"` or inspect it with
`lsof -ti:9000` before restarting.

- API: `http://localhost:9000`
- Admin UI: `http://localhost:9000/app`
- Admin sellers page: `http://localhost:9000/app/sellers`
- Admin: `admin@pawnpawn.com` / `supersecret`
- Buyers: password `buyer1234` (see [`SAMPLE_DATA.md`](./SAMPLE_DATA.md))

## Keeping Docs in Sync

Update the relevant file whenever you change schema, routes, module methods, or seed data:

- Schema/SQL → `POSTGRESQL_COMMANDS.md` + `AI_CONTEXT.md`
- Routes → `API.md` (including the implementation-status table)
- Demo data/credentials → `SAMPLE_DATA.md`
- Setup/commands → `LOCAL_DEPLOYMENT.md`
- Conventions/gotchas → `AGENTS.md`
