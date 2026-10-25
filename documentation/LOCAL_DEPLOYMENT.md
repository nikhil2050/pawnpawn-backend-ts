# Local Deployment & Testing Guide — PawnPawn Backend

> **Purpose**: Step-by-step guide to deploy and test the PawnPawn Medusa v2 backend locally.
> **Location**: `/documentation/LOCAL_DEPLOYMENT.md`
> **Target audience**: Freshers / new developers joining the project
> **Last Updated**: Oct 2026

---

## Overview

This guide walks you through the complete local development cycle:

1. Verify prerequisites (Node.js, npm)
2. Start PostgreSQL and create the database
3. Configure environment variables
4. Run Medusa migrations (built-in tables)
5. Import custom schema (seller, product_lineage, listing_type)
6. Verify admin login (admin@pawnpawn.com / supersecret)
7. Start the dev server
8. Test API endpoints with curl
9. Iterate: modify → test → repeat

---

## Prerequisites Check

Run from your project root:

```bash
# Working directory
cd /Users/nikhilkshirsagar/AdvancedComputing/NKProjects/PawnPawnTS/Projects/pawnpawn-backend-ts/apps/backend

# Verify Node.js (package.json engines require >= 22.22.0)
node --version
# Current shell on this machine: v22.14.0 (works)
# nvm also has v24.15.0 available; use it if you hit Node-related errors:
#   nvm use 24.15.0

# Verify npm (packageManager is npm@11.12.1)
npm --version
# Expected: 10.x or higher
```

---

## Step 1: Start PostgreSQL & Create Database

### Check if PostgreSQL is running

```bash
pg_isready -h localhost -p 5432
```

Expected output: `/var/run/postgresql:5432 - accepting connections`

### If PostgreSQL is not running

**macOS (Homebrew):**
```bash
brew services start postgresql@15
```

**Linux (systemd):**
```bash
sudo systemctl start postgresql
```

### Create the database

```bash
createdb -h localhost -U postgres pawnpawn_db
```

### Verify the database exists

```bash
psql -h localhost -U postgres -l | grep pawnpawn
```

Expected output should show `pawnpawn_db` in the list.

---

## Step 2: Configure Environment Variables

```bash
# From apps/backend directory
cp .env.example .env
```

### Review `.env`

Open `.env` and verify these key values:

| Variable        | Default Value                                             | Notes                     |
|-----------------|-----------------------------------------------------------|---------------------------|
| `DATABASE_URL`  | `postgres://postgres:postgres@localhost:5432/pawnpawn_db` | Must match your DB        |
| `STORE_CORS`    | `http://localhost:3000,http://localhost:3001`             | Buyer + Seller apps       |
| `ADMIN_CORS`    | `http://localhost:9000,http://localhost:5173`             | Admin dashboard           |
| `JWT_SECRET`    | `supersecret`                                             | **Change in production!** |
| `COOKIE_SECRET` | `supersecret`                                             | **Change in production!** |

No changes needed for local development — defaults work.

---

## Step 3: Run Medusa Migrations

Medusa v2 needs its own tables (product, cart, order, customer, etc.) before your custom tables can reference them.

### Run migrations
```bash
cd apps/backend

../../node_modules/.bin/medusa db:migrate
```

### Important notes about `db:migrate`

- **Schema migrations succeed**: You'll see `Database already up-to-date`
- **Migration scripts step fails**: You'll see `Cannot read properties of undefined (reading 'acquire')` — this is **non-fatal**. The schema is fully created; only the optional `create-super-admin-role.js` seed script fails because `defineConfig()` isn't available due to ts-node ESM/CJS interop.
- See `documentation/DB_MIGRATE_WORKAROUND.md` for details.

### Verify Medusa tables were created

```bash
psql -h localhost -U postgres -d pawnpawn_db -c "\dt"
```

You should see tables like: `product`, `cart`, `order`, `customer`, `address`, `user`, `api_key`, etc.

> ⚠️ **Important**: Run migrations BEFORE importing custom schema. The `product` table must exist before we can add the `listing_type` column to it.

---

## Step 4: Import Custom Schema

Your custom tables (`seller`, `product_lineage`) and the `product.listing_type` extension are defined in `sql/schema.sql`.

```bash
cd apps/backend

# Import custom SQL schema
npm run db:import
```

This executes `scripts/import-sql.ts` which reads `sql/schema.sql` and runs each statement against PostgreSQL.

### Verify custom tables

```bash
psql -h localhost -U postgres -d pawnpawn_db -c "\dt seller product_lineage"
```

### Verify product.listing_type column

```bash
psql -h localhost -U postgres -d pawnpawn_db -c "\d product"
```

Look for: `listing_type product_listing_type NOT NULL DEFAULT 'FIXED_PRICE'`

### Load sample data (optional)

Seeds 7 sellers (6 celebrity + 1 buyer-turned-seller), 5 buyer accounts, celebrity listings with USD/INR prices (the Europe/EUR region exists but seeded listings do not include EUR prices), and purchase lineage:

```bash
psql -h localhost -U postgres -d pawnpawn_db -v ON_ERROR_STOP=1 -f sql/sample-data.sql
```

> Buyers must exist before seeding: the script only attaches shipping metadata and lineage to existing customers. Register them through `POST /auth/customer/emailpass/register` followed by `POST /store/customers` (or use the API keys/credentials in [`SAMPLE_DATA.md`](./SAMPLE_DATA.md)). If a buyer is missing, the lineage loop prints a `NOTICE` and skips that row.

See [`documentation/SAMPLE_DATA.md`](./SAMPLE_DATA.md) for buyer credentials, the full dataset, and verification queries.

---

## Step 5: Verify Admin Login

An admin user already exists in the database (seeded during Medusa migration):

| Field | Value |
|-------|-------|
| Email | `admin@pawnpawn.com` |
| Password | `supersecret` |

### Test admin login via API

```bash
curl -s -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pawnpawn.com","password":"supersecret"}'
```

Should return a JWT token.

**Note**: The `medusa user` command does NOT work without `defineConfig()` (missing `api_key` service). If you need to create additional admin users, use the Admin UI at `http://localhost:9000/app` or update the database directly.

---

## Step 6: Start the Dev Server

```bash
cd apps/backend

../../node_modules/.bin/medusa develop
```

Or from the project root:

```bash
npm run backend:dev
```

Expected output:

```text
✔ Server is ready on port: 9000 – 2080ms
info:    Admin URL → http://localhost:9000/app
```

Keep this terminal open — the server needs to stay running while you test.

### Stop / Restart

```bash
# Stop (Ctrl+C in the server terminal), or:
pkill -f "medusa develop"

# If port 9000 is stuck
lsof -ti:9000 | xargs kill -9

# Restart
../../node_modules/.bin/medusa develop
```

---

## Step 7: Test API Endpoints

Open a **new terminal** (keep the dev server running in the first one).

### Test Health Check

```bash
curl http://localhost:9000/health
```

Expected: `OK`

### Get Publishable API Key

```bash
psql -h localhost -U postgres -d pawnpawn_db -c "SELECT token FROM api_key WHERE type = 'publishable' AND deleted_at IS NULL LIMIT 1;"
```

### Test List Products (with publishable API key)

```bash
API_KEY="<the token from above>"
curl -s -H "x-publishable-api-key: $API_KEY" http://localhost:9000/store/products | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Found {d.get(\"count\",0)} products')"
```

Expected: `{"count":17,...}` with sample data seeded (4 Medusa demo products otherwise)

### Custom Routes: Current Status

> **Implemented reads + writes:** `GET /admin/seller`, `GET /admin/seller/:id`, `POST /admin/seller`, `PATCH /admin/seller/:id`, and `DELETE /admin/seller/:id` (soft-delete via `is_deactivated`), plus the Medusa Admin **Sellers** page at `/app/sellers`.  
> **Planned:** `/store/seller/*`, custom `POST /store/products`, auctions, `/store/purchase`, `/store/products/:id/lineage`, and `/admin/lineage*`. See `API.md` → Current Implementation Status.

### Test Seller Module (Working Today)

The full seller module behavior is exercised with `medusa exec`; admin reads are tested separately below.

```bash
cd apps/backend
../../node_modules/.bin/medusa exec ./src/scripts/verify-sample-data.ts
```

Expected:

```text
[seller] total=7 trusted=6 musicians=3
[seller] handles=sarah_resells, leonardodicaprio, rihanna, beyonce, kimkardashian, snoopdogg, dwaynejohnson
[seller] findByHandle(snoopdogg)=Snoop Dogg Shop
[seller] create/update ok: id=... trust=untrusted found=true
[lineage] prod_snoop_001 history=2 currentOwner=cus_...
[lineage] recordTransfer ok: id=... historyNow=3
```

Inspect sellers directly:

```bash
psql -h localhost -U postgres -d pawnpawn_db -c \
  "SELECT handle, store_name, seller_trust, seller_category FROM seller ORDER BY handle;"
```

### Test Admin Login

```bash
curl -s -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pawnpawn.com","password":"supersecret"}'
```

Expected: Returns a JWT token.

### Test Admin Sellers API + Page (Working Today)

```bash
TOKEN=$(curl -s -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pawnpawn.com","password":"supersecret"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# All sellers
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9000/admin/seller \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['count'], [s['handle'] for s in d['sellers']])"

# Filters
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9000/admin/seller?trust=untrusted"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9000/admin/seller?category=musician"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9000/admin/seller?q=snoop"
```

Expected: `7 ['beyonce', 'rihanna', 'kimkardashian', 'leonardodicaprio', 'sarah_resells', 'snoopdogg', 'dwaynejohnson']`, with `1` result for each filter above.

In the browser, open `http://localhost:9000/app/sellers`. The **Sellers** sidebar page should list all 7 sellers with trust, category, verification, bio, social handle, and customer-link columns. Opening the page also logs a successful `GET /admin/seller?limit=100` request.

Unauthenticated access should return `401`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9000/admin/seller
```

### Test Create Product (Fixed Price) — Planned

`POST /store/products` (custom seller listing) is not implemented. Until it is, create listings with the Admin API or directly in the database. The seeded example:

```bash
psql -h localhost -U postgres -d pawnpawn_db -c \
  "SELECT id, title, listing_type FROM product WHERE id = 'prod_snoop_001';"
```

### Test Create Product (Auction) — Planned

Auction routes are not implemented. `listing_type = 'AUCTION'` is stored on the product row, but there is no auction workflow yet.

### Test Get Product Lineage — Planned

`GET /store/products/:id/lineage` is not implemented. Read lineage through the module service or SQL:

```bash
psql -h localhost -U postgres -d pawnpawn_db -c \
  "SELECT product_id, seller_id, buyer_id, price, transacted_at
     FROM product_lineage WHERE product_id = 'prod_snoop_001'
     ORDER BY transacted_at;"
```

Expected: two rows for the seeded Snoop Dogg Platinum Chain (Sarah, then Olivia).

### Manage Seller Trust & Category

Use the admin REST API (preferred) or the module service from a script:

```http
PATCH /admin/seller/<seller_id>
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "seller_trust": "untrusted",
  "seller_category": "athlete",
  "social_media_handle": "@newhandle",
  "bio": "Updated bio"
}
```

Or use the module service from a script:

```ts
const sellerService = container.resolve("seller")

await sellerService.updateTrustStatus(sellerId, "untrusted")
await sellerService.updateCategory(sellerId, "athlete")
await sellerService.updateSocialMedia(sellerId, "@newhandle")
await sellerService.updateBio(sellerId, "Updated bio")
```

Equivalent SQL:

```sql
UPDATE seller
SET seller_trust = 'untrusted',
    seller_category = 'athlete',
    social_media_handle = '@newhandle',
    bio = 'Updated bio',
    updated_at = NOW()
WHERE handle = 'sarah_resells';
```

---

## Step 8: Iterate — Modify → Test Cycle

For every code change:

```bash
# 1. Stop the dev server (Ctrl+C in the server terminal)
# 2. Make your code changes
# 3. If you changed SQL schema:
   npm run db:import
# 4. If you added/modified Medusa migrations:
   ../../node_modules/.bin/medusa db:migrate
# 5. Restart the server:
   ../../node_modules/.bin/medusa develop
# 6. Re-test endpoints with curl
```

---

## Quick Reference: All Commands

Run all commands from `apps/backend/` directory.

| Task | Command |
|------|---------|
| Check Node version | `node --version` |
| Start PostgreSQL | `brew services start postgresql@15` |
| Create database | `createdb -h localhost -U postgres pawnpawn_db` |
| List databases | `psql -h localhost -U postgres -l` |
| Copy env template | `cp .env.example .env` |
| Run Medusa migrations | `../../node_modules/.bin/medusa db:migrate` |
| Import custom SQL | `npm run db:import` |
| Seed sample data | `psql -h localhost -U postgres -d pawnpawn_db -f sql/sample-data.sql` |
| Verify seller/lineage modules | `../../node_modules/.bin/medusa exec ./src/scripts/verify-sample-data.ts` |
| List all tables | `psql -h localhost -U postgres -d pawnpawn_db -c "\dt"` |
| Describe product table | `psql -h localhost -U postgres -d pawnpawn_db -c "\d product"` |
| Admin login API | `curl -X POST http://localhost:9000/auth/user/emailpass -d '{"email":"admin@pawnpawn.com","password":"supersecret"}'` |
| List sellers | `curl -H "Authorization: Bearer $TOKEN" http://localhost:9000/admin/seller` |
| Create seller | `curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...}' http://localhost:9000/admin/seller` |
| Update seller | `curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...}' http://localhost:9000/admin/seller/:id` |
| Deactivate seller | `curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:9000/admin/seller/:id` |
| Start dev server | `../../node_modules/.bin/medusa develop` |
| Start from project root | `npm run backend:dev` (run from repo root, not `apps/backend`) |
| Stop dev server | `pkill -f "medusa develop"` |
| Run lint | `npm run lint` |
| Build for production | `npm run build` |
| Connect to DB interactively | `psql -h localhost -U postgres -d pawnpawn_db` |

---

## Common Issues & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| `Connection refused` on port 5432 | PostgreSQL not running | `brew services start postgresql@15` |
| `database "pawnpawn_db" does not exist` | DB not created | `createdb -h localhost -U postgres pawnpawn_db` |
| `listing_type column not found` | Migrations not run yet | Run `../../node_modules/.bin/medusa db:migrate` first, then `npm run db:import` |
| `CORS error` from frontend | Missing origin in CORS config | Add `http://localhost:3000` to `STORE_CORS` in `.env` |
| `401 Unauthorized` on a protected endpoint | Not authenticated | Login first to get JWT token/cookie |
| `EADDRINUSE: port 9000` | Another Medusa dev server is running | `pkill -f "medusa develop"`; if needed `lsof -ti:9000 \| xargs kill -9` |
| `this.list is not a function` | Called a generic method in a `MedusaService` subclass | Use `listSellers` / `updateSellers` / `listProductLineages` etc. |
| `seller endpoints` return 404 | Only the admin seller CRUD is implemented | Use `GET/POST/PATCH/DELETE /admin/seller*` / `/app/sellers`, or `container.resolve("seller")` / SQL for store routes; see `API.md` status table |
| `Medusa requires Node ≥ 22.22.0` | Old Node version | `nvm install 24.15.0 && nvm use 24.15.0` |
| `npm run db:import` fails | `ts-node` not found | Ensure devDependencies are installed: `npm install` |
| `npx medusa` commands fail | `npx` downloads wrong package | Use `../../node_modules/.bin/medusa` instead |
| Store API requires publishable key | Missing `x-publishable-api-key` header | Get key: `psql ... -c "SELECT token FROM api_key WHERE type='publishable'"` |
| `npm run db:import` fails with ESM error | `ts-node --esm` incompatible | Removed `--esm` from script; uses `ts-node src/scripts/import-sql.ts` |
| `medusa user` command fails | `api_key` service not registered without `defineConfig` | Use Admin UI at `http://localhost:9000/app` or update DB directly |
| Admin login via UI fails | Auth provider not registered | Use API: `POST /auth/user/emailpass` with `admin@pawnpawn.com` / `supersecret` |
| `defineConfig is not defined` | ts-node ESM/CJS interop issue | Use `medusa-config.js` with `require('dotenv')` + manual modules |
| `medusa build` fails with `medusa-config.ts ... TS1010: '*/' expected` | Stale/broken duplicate TypeScript config | Keep only `medusa-config.js`; remove `medusa-config.ts` |
| Admin UI pages error (500) | Missing default core modules | Ensure all core modules registered in `medusa-config.js` modules object |

---

## Testing Checklist

Before considering your local setup complete, verify:

- [ ] PostgreSQL is running and accepting connections
- [ ] `pawnpawn_db` database exists
- [ ] `.env` file is configured with correct `DATABASE_URL`
- [ ] `../../node_modules/.bin/medusa db:migrate` completed without errors (migration scripts error is expected and non-fatal)
- [ ] `npm run db:import` completed without errors
- [ ] `seller` and `product_lineage` tables exist in DB
- [ ] `product` table has `listing_type` column
- [ ] Admin login works: `POST /auth/user/emailpass` with `admin@pawnpawn.com` / `supersecret`
- [ ] Buyer login works: `POST /auth/customer/emailpass` with `sarah.johnson@gmail.com` / `buyer1234`
- [ ] Dev server starts on `http://localhost:9000`
- [ ] `GET /health` returns healthy
- [ ] `GET /store/products` returns 17 products with the publishable key
- [ ] `medusa exec ./src/scripts/verify-sample-data.ts` passes
- [ ] `GET /admin/seller` returns 7 sellers with an admin token (401 without one)
- [ ] Admin **Sellers** page loads at `http://localhost:9000/app/sellers` and lists all 7 sellers
- [ ] `POST /admin/seller` creates a seller and returns 201
- [ ] `PATCH /admin/seller/:id` updates seller fields and returns 200
- [ ] `DELETE /admin/seller/:id` soft-deactivates a seller (sets `is_deactivated = true`)
- [ ] Admin UI loads at `http://localhost:9000/app` without errors

> Remaining custom routes (`/store/seller/*`, custom `POST /store/products`, auctions, `/store/purchase`, `/store/products/:id/lineage`, `/admin/lineage*`) are not implemented yet. Admin seller CRUD (read/create/update/deactivate) is implemented and should be included in validation.

---

## File Structure Reference

```
apps/backend/
├── medusa-config.js          # DB URL, CORS, secrets config (.js NOT .ts)
├── .env                      # Local environment (copy from .env.example)
├── .env.example              # Environment template
├── package.json              # Scripts: dev, start, build, db:import
├── sql/
│   ├── schema.sql            # Custom DDL: seller, product_lineage, listing_type
│   └── sample-data.sql       # Idempotent demo seed
├── src/
│   ├── modules/
│   │   ├── seller/
│   │   │   ├── index.ts          # Module("seller", ...)
│   │   │   ├── models/seller.ts  # Seller data model
│   │   │   └── service.ts        # SellerModuleService
│   │   └── lineage/
│   │       ├── index.ts          # Module("lineage", ...)
│   │       ├── models/product-lineage.ts  # ProductLineage data model
│   │       └── service.ts        # LineageModuleService
│   ├── scripts/
│   │   ├── import-sql.ts         # TypeScript runner for schema.sql
│   │   └── verify-sample-data.ts # Round-trip module verification
│   ├── admin/
│   │   └── routes/sellers/page.tsx # Admin Sellers list page (/app/sellers)
│   └── api/
│       ├── store/custom/route.ts # Placeholder (no PawnPawn store routes yet)
│       ├── admin/custom/route.ts # Placeholder
│       ├── admin/seller/route.ts # GET /admin/seller (list/filter)
│       ├── admin/seller/[id]/route.ts # GET /admin/seller/:id
│       └── middlewares.ts        # Store search middleware
└── README.md                     # Medusa scaffolding (points to documentation/)

documentation/
├── README.md                 # Documentation index
├── AI_CONTEXT.md             # Full project context for LLMs
├── API.md                    # OpenAPI spec + endpoint documentation
├── SAMPLE_DATA.md            # Seeded sellers, buyers, listings, lineage
├── POSTGRESQL_COMMANDS.md    # PostgreSQL command reference
├── LOCAL_DEPLOYMENT.md       # This file
├── DB_MIGRATE_WORKAROUND.md  # Workaround for defineConfig/migration scripts issue
├── AGENTS.md                 # Medusa agent instructions
└── CLAUDE.md                 # Claude config (reads AGENTS.md)
```

---

*This guide should be updated as the project evolves. If you encounter an issue not covered here, check `POSTGRESQL_COMMANDS.md` for DB-specific commands or `API.md` for endpoint details.*