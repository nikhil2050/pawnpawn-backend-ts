# PawnPawn Backend Documentation

Index for all project documentation. The backend is a Medusa v2.22.0 service in `apps/backend/`, seeded with celebrity-memorabilia demo data.

## Document Map

| Document | Read it for |
|----------|-------------|
| [`AI_CONTEXT.md`](./AI_CONTEXT.md) | Architecture, directory layout, schema, config, module services, workflows |
| [`API.md`](./API.md) | OpenAPI spec, endpoint summary, implementation status, request/response examples |
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
- Seller onboarding, seller listing CRUD, admin listing review, and HQ fulfillment transitions are implemented (`POST /store/seller/onboard`, `GET/POST /store/seller/listings`, `POST /store/seller/products`, `PATCH /store/seller/listings/:id`, `GET /store/sellers/:handle`, `GET /admin/listings`, `POST /admin/listings/:id/review`, `GET /admin/seller/:id/listings`, `POST /admin/hq-fulfillments/:id`).
- Custom storefront routes are **planned**: `PATCH /store/seller/me`, custom `POST/PATCH /store/products`, auctions, purchase, lineage, and `/admin/lineage*`. See [`API.md`](./API.md#current-implementation-status).
- Product creation normalizes handles server-side and allocates `-2`, `-3`, and later suffixes for duplicates. Admin product creation enforces one selected value per option and shows the final persisted handle in the success notification.
- The `product.created` subscriber applies marketplace defaults to Seller and Admin products: standard SKU, one-unit inventory, and an idempotent `PENDING_APPROVAL` Listing. Admin products without seller metadata use the system Seller.
- Database and seed data are verified: 8 sellers, 5 buyers, 17 products (13 published marketplace products), 33 variants, 72 prices, 13 listings, 13 unique marketplace inventory units, native fashion taxonomy/options, and 8 lineage records.

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
