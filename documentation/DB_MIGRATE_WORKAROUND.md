# Migration Scripts Workaround — medusa-config.js

> **Location**: `/documentation/DB_MIGRATE_WORKAROUND.md`  
> **Problem**: `../../node_modules/.bin/medusa db:migrate` fails at the migration scripts step with:  
>               `TypeError: Cannot read properties of undefined (reading 'acquire')`  
> **Root Cause**: The `defineConfig()` helper (from `@medusajs/framework/utils`) fails to resolve under medusa CLI's ts-node ESM/CJS interop. Without `defineConfig`, Medusa doesn't inject default core modules — including `locking-postgres` — which migration scripts need for advisory locks (`pg_advisory_lock`).  
> **Status**: Migrations themselves succeed ("Database already up-to-date"); only the optional migration-script seeding step fails. Admin login works via `POST /auth/user/emailpass` with manually registered auth module.

---

## What Happens When You Run `db:migrate`

```bash
cd apps/backend
../../node_modules/.bin/medusa db:migrate
```

### Output you will see (normal)

```
[info]: Database already up-to-date
[info]: redisUrl not found. A fake redis instance will be used.
[info]: Pending migration scripts to execute
[info]:   /.../create-super-admin-role.js
[info]: Running migration scripts...
[error]: Cannot read properties of undefined (reading 'acquire')
TypeError: Cannot read properties of undefined (reading 'acquire')
```

### What succeeded vs failed

| Step | Result | Details |
|------|--------|---------|
| Config load | ✅ Success | `medusa-config.js` loads with `require('dotenv')` |
| MikroORM migrations | ✅ Success | `Database already up-to-date` — all Medusa schema tables created |
| Migration scripts | ❌ Fails | `create-super-admin-role.js` can't acquire advisory lock — locking module not registered |

The error is **non-fatal** for running the backend. The database schema is fully created. Only the optional seed script (which creates a default super-admin role) does not run.

---

## Workaround Steps

### Step 1: Run the migration (schema only)

From `apps/backend/`:

```bash
../../node_modules/.bin/medusa db:migrate
```

Expected result: `Database already up-to-date` (or first run creates all tables).  
Ignore the `Cannot read properties of undefined` error at the end — the schema migrations have already completed successfully.

### Step 2: Verify Medusa tables exist

```bash
psql -h localhost -U postgres -d pawnpawn_db -c "\dt"
```

You should see Medusa tables: `product`, `cart`, `order`, `customer`, `address`, `user`, `api_key`, etc.

### Step 3: Import your custom schema (seller, product_lineage, listing, hq_fulfillment)

```bash
npm run db:import
```

This runs `src/scripts/import-sql.ts` which executes `sql/schema.sql` directly via `pg`. The script is idempotent, so it is safe to re-run after schema changes.

`schema.sql` includes a compatibility block that:

- Drops the helper views (`product_current_owner`, `seller_stats`) before altering columns.
- Converts `seller.id`, `product_lineage.id`, and `product_lineage.seller_id` to `TEXT` (Medusa generates text IDs).
- Adds `customer_id`, `created_at`, `updated_at`, and `deleted_at` where Medusa's generated queries require them.
- Relaxes a legacy `NOT NULL` on `seller.razorpay_account_id` so sellers can exist before Razorpay onboarding.
- Recreates the views afterwards.

Verify:

```bash
psql -h localhost -U postgres -d pawnpawn_db -c "\dt seller product_lineage"

# IDs must be text, not uuid
psql -h localhost -U postgres -d pawnpawn_db -c "\d seller" | grep " id "
psql -h localhost -U postgres -d pawnpawn_db -c "\d product_lineage" | grep -E " id | seller_id "
```

Expected: `id | text | not null` and `seller_id | text`.

> If `db:import` fails with `cannot alter type of a column used by a view`, re-run it — the view-drop block runs first. If a manual alteration was interrupted, drop both views, re-run, then confirm they were recreated with `\dv`.

<!-- Listing fields are checked here because marketplace ownership now lives in
     the custom Listing module instead of Medusa's product table. See
     AI_CONTEXT.md §4.2 and §5.6.3. -->
### Step 4: Verify Listing ownership fields

```bash
psql -h localhost -U postgres -d pawnpawn_db -c "\d listing"
```

Look for: `seller_id`, `product_id`, `listing_status`, `listing_type`, and `admin_feedback`.

### Step 5: Seed sample data (optional but recommended)

```bash
psql -h localhost -U postgres -d pawnpawn_db -v ON_ERROR_STOP=1 -f sql/sample-data.sql
```

This loads 9 marketplace sellers (including Karan Johar and Kate Winslet), links `sarah_resells` to Sarah Johnson's customer account, creates 15 normalized seller Listings, stocks one inventory unit per marketplace variant, and preserves 8 lineage records. See [`SAMPLE_DATA.md`](./SAMPLE_DATA.md) and the [Marketplace Architecture Decision Record](./AI_CONTEXT.md#marketplace-architecture-decision-record).

Verify the modules against it:

```bash
../../node_modules/.bin/medusa exec ./src/scripts/verify-sample-data.ts
```

### Step 5: Admin user already exists

The admin user was seeded during Medusa migration:

| Field | Value |
|-------|-------|
| Email | `admin@pawnpawn.com` |
| Password | `supersecret` |

Test login via API:

```bash
curl -s -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pawnpawn.com","password":"supersecret"}'
```

Returns a JWT token.

**Note**: The `medusa user` command does NOT work without `defineConfig` (missing `api_key` service). Use the API endpoint above or the Admin UI at `http://localhost:9000/app`.

### Step 6: Start the dev server

```bash
../../node_modules/.bin/medusa develop
```

Server will be ready on `http://localhost:9000`. Admin UI at `http://localhost:9000/app`.

### Step 7: Get publishable API key for testing store API

```bash
psql -h localhost -U postgres -d pawnpawn_db -c "SELECT token FROM api_key WHERE type = 'publishable' AND deleted_at IS NULL LIMIT 1;"
```

Test with curl:

```bash
API_KEY="<the token from above>"
curl -H "x-publishable-api-key: $API_KEY" http://localhost:9000/store/products
```

---

## Root Cause Details

### Why `defineConfig()` fails

The medusa CLI loads `medusa-config.ts` through `ts-node`. Under this ts-node configuration:

```typescript
import { loadEnv, defineConfig } from '@medusajs/framework/utils'
```

results in `defineConfig is undefined` at runtime. The `@medusajs/framework/utils` package re-exports from `@medusajs/utils` as CommonJS (`exports.loadEnv`, `exports.defineConfig`), but ts-node's ESM interop doesn't resolve named imports correctly for this package.

Attempts that were tried and failed:
1. `import { loadEnv, defineConfig } from '@medusajs/framework/utils'` → `defineConfig is undefined`
2. `const { loadEnv, defineConfig } = require('@medusajs/framework/utils')` → `defineConfig is undefined`
3. `const frameworkUtils = require('@medusajs/framework/utils'); const { loadEnv, defineConfig } = frameworkUtils` → `defineConfig is undefined`
4. `import * as frameworkUtils from '@medusajs/framework/utils'` → `defineConfig is undefined`

### Current solution: Plain `module.exports` with manual modules

The working config (`medusa-config.js`) uses plain CommonJS with `require('dotenv')` and manually registers all essential modules. There must be **one** config file: `medusa-config.js`. A stale `medusa-config.ts` was removed — keeping a second config file (or a broken one) makes `medusa build` fail during TypeScript compilation.

The `modules` block below is abbreviated — the live file lists every core module explicitly and then the two custom ones:

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
    // auth (with emailpass provider), user, api_key, store,
    // stock_location, inventory, product, pricing, promotion,
    // customer, sales_channel, cart, region, tax, currency,
    // payment, order, settings,
    // fulfillment (with manual provider),
    // notification (with local provider),
    // search (with postgres provider),
    // cache (inmemory), event_bus (local), locking, file (local)
    // Custom PawnPawn modules:
    // seller, lineage
  },
}
```

### What `defineConfig` normally injects

When `defineConfig()` works, Medusa automatically registers default core modules including:
- `locking-postgres` (advisory locks for migration scripts)
- `event-bus-local` (event system)
- `cache-inmemory` or `cache-redis` (caching)
- `notification-local` (notifications)
- `file-local` (file storage)
- `payment-stripe` (payment provider)
- `fulfillment-manual` (fulfillment provider)
- `auth` with `emailpass` provider
- `user`, `api-key`, `store`, `rbac`, etc.

Without `defineConfig`, these default modules are NOT registered automatically, so they must be added manually as shown above.

---

## Summary Checklist

- [ ] `medusa-config.js` exists with `require('dotenv')` and plain `module.exports`
- [ ] No `medusa-config.ts` exists (a stale `.ts` config breaks `medusa build`)
- [ ] `.env` exists with correct `DATABASE_URL`
- [ ] `npm run db:import` completed (custom schema: seller, product_lineage, listing, hq_fulfillment)
- [ ] Optional: sample data seeded (`psql ... -f sql/sample-data.sql`)
- [ ] Optional: `medusa exec ./src/scripts/verify-sample-data.ts` passes
- [ ] `../../node_modules/.bin/medusa db:migrate` ran (schema created; migration scripts error is expected and non-fatal)
- [ ] Admin user exists: `admin@pawnpawn.com` / `supersecret`
- [ ] Admin login works: `POST /auth/user/emailpass`
- [ ] Dev server running (`medusa develop`) on `http://localhost:9000`
- [ ] `GET /health` returns OK
- [ ] `GET /store/products` returns products with publishable API key
- [ ] Admin UI loads at `http://localhost:9000/app` without errors

---

## Future Fix

To properly fix the `defineConfig` issue, you would need to resolve the ts-node ESM/CJS interop problem with `@medusajs/framework/utils`. Possible approaches:

1. Add a `tsconfig.json` with `"module": "CommonJS"` and `"esModuleInterop": true` specifically for the config file
2. Use `import * as utils from '@medusajs/framework/utils'` and destructure at runtime
3. Convert the project to use ESM (`"type": "module"` in `package.json`) with proper `.mjs` extensions

Until then, the plain `module.exports` config without `defineConfig` works for running the server and API, which is sufficient for local development.
