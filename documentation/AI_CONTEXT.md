# AI_CONTEXT.md - PawnPawn Backend (Medusa v2)

> **Purpose**: Complete project context for LLMs to understand the PawnPawn marketplace backend.
> **Location**: `/documentation/AI_CONTEXT.md`
> **Last Updated**: Oct 2026

---

## 🎯 Project Overview

**PawnPawn** is a peer-to-peer marketplace platform where users can buy and sell second-hand items. The backend is built on **Medusa v2** (Node.js/TypeScript) and serves two frontend applications:
- **Buyer App** (`pawnpawn-frontend-buyer-ts`) - Next.js on `http://localhost:3000`
- **Seller App** (`pawnpawn-frontend-seller-ts`) - Next.js on `http://localhost:3001`

### Key Business Concepts
| Concept | Description |
|---------|-------------|
| **Seller** | Marketplace vendor with verification status, Razorpay Connect account, trust level (`trusted`/`untrusted`), and category (`celebrity`, `influencer`, `musician`, `athlete`, `other`) |
| **Product** | Items listed for sale - either FIXED_PRICE or AUCTION |
| **Product Lineage** | Complete ownership chain: seller → buyer → buyer → ... |
| **Purchase** | Transaction creating a lineage entry and transferring ownership (lineage module implemented; `/store/purchase` route planned) |

---

## 🏗️ Architecture

### Tech Stack
```
├── Runtime: Node.js ≥ 22.22.0 required (current shell: v22.14.0; v24.15.0 available via nvm)
├── Framework: Medusa v2.22.0 (@medusajs/medusa)
├── Language: TypeScript 5.6+
├── Database: PostgreSQL 15+ (local instance: pawnpawn_db)
├── ORM: Medusa's internal (MikroORM-based)
├── Package Manager: npm 11.12.1 (Turborepo workspace)
└── Monorepo: Turborepo (root: /PawnPawnTS)
```

### 🍵 Java Developer Cheat Sheet — TypeScript & Medusa Concepts

If you're coming from a Java/Spring Boot background, here's a quick mapping:

| Java Concept | TypeScript / Medusa Equivalent | Notes |
|--------------|-------------------------------|-------|
| `class` / `interface` | `interface` / `type` | TypeScript interfaces define object shapes |
| `@Entity` + `@Table` | Medusa module model + MikroORM | Medusa manages entities internally |
| `@Id @GeneratedValue` | `id TEXT PRIMARY KEY` (Medusa-generated) | Medusa generates text IDs, not UUIDs |
| `@Column(unique = true)` | `VARCHAR UNIQUE` | SQL constraint |
| `@Enumerated(EnumType.STRING)` | PostgreSQL `ENUM` type | `seller_verification_status`, `product_listing_type` |
| `@CreatedDate` / `@LastModifiedDate` | `created_at TIMESTAMPTZ DEFAULT NOW()` | Database-managed timestamps |
| `System.getenv("KEY")` | `process.env.KEY` | Environment variables |
| `application.properties` | `.env` / `medusa-config.js` | Configuration |
| `@CrossOrigin(origins=...)` | `storeCors` / `adminCors` in config | CORS settings |
| `@SpringBootApplication` | `medusa-config.js` `module.exports` | App configuration |
| `CompletableFuture` / `@Async` | `async` / `await` | Non-blocking async I/O |
| `System.exit(1)` | `process.exit(1)` | Terminate process |
| `pom.xml` / `build.gradle` | `package.json` | Dependencies & scripts |
| `mvn spring-boot:run` | `npm run dev` (`medusa develop`) | Start dev server |
| `Flyway` / `Liquibase` migration | `sql/schema.sql` + `npm run db:import` | Raw SQL DDL |
| `HikariDataSource` | `pg.Pool` | Connection pool |
| `Connection` | `pg.Client` | Single DB connection |
| `PreparedStatement.executeUpdate()` | `client.query(sql)` | Execute SQL |
| `DTO` / `Projection` | SQL `VIEW` (e.g., `seller_stats`) | Read-only query result |
| `@Service` + business logic | Medusa Workflows + Steps | Business logic layer |
| `@RestController` + `@RequestMapping` | File-based routes in `src/api/store/` | API endpoints |
| `slf4j` / `Logger` | `console.log()` / `console.error()` | Logging |

**Key TypeScript syntax for Java developers:**
- `const x = value` — immutable (like `final`)
- `let x = value` — mutable
- `function name(param: type): returnType {}` — typed function
- `interface Name { prop: type }` — object shape (like a Java interface)
- `` `string ${var}` `` — template literal (string interpolation)
- `=>` — arrow function (like Java lambda `x -> x * 2`)
- `null` / `undefined` — both represent "no value" (Java's `null`)

---

## 📁 Directory Structure

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
        │       │   ├── schema.sql     # Custom DDL: seller, product_lineage, listing_type
        │       │   └── sample-data.sql # Idempotent demo seed (sellers, listings, lineage)
        │       ├── src/
        │       │   ├── modules/
        │       │   │   ├── seller/
        │       │   │   │   ├── index.ts         # Module("seller", { service: SellerModuleService })
        │       │   │   │   ├── models/seller.ts # Seller data model
        │       │   │   │   └── service.ts       # SellerModuleService (findByHandle, verifySeller, updateRazorpayAccount, findTrustedSellers, findSellersByCategory, updateTrustStatus, updateCategory, updateSocialMedia, updateBio)
        │       │   │   └── lineage/
        │       │   │       ├── index.ts         # Module("lineage", { service: LineageModuleService })
        │       │   │       ├── models/product-lineage.ts  # ProductLineage data model
        │       │   │       └── service.ts       # LineageModuleService (recordTransfer, getLineageHistory, getCurrentOwner)
        │       │   ├── scripts/
        │       │   │   ├── import-sql.ts        # SQL runner (npm run db:import)
        │       │   │   └── verify-sample-data.ts # Round-trip seller/lineage verification
        │       │   ├── api/
        │       │   │   ├── store/custom/route.ts # Placeholder only (no PawnPawn store routes yet)
        │       │   │   ├── admin/custom/route.ts # Placeholder only
        │       │   │   ├── admin/seller/route.ts # GET /admin/seller (list/filter/paginate)
        │       │   │   ├── admin/seller/[id]/route.ts # GET /admin/seller/:id
        │       │   │   └── middlewares.ts       # Store search middleware (configureStoreSearch)
        │       │   ├── admin/
        │       │   │   └── routes/sellers/page.tsx # Sellers page in Medusa Admin (/app/sellers)
        │       │   ├── jobs/                    # Scheduled jobs
        │       │   ├── links/                   # Module links
        │       │   ├── search/                  # Product search index definition
        │       │   ├── subscribers/             # Event subscribers
        │       │   └── workflows/               # Business logic workflows
        │       ├── README.md                    # Medusa default
        │       └── node_modules/                # Installed (1362 packages)
```

---

## 🗄️ Database Schema

### Custom Tables (Defined in `sql/schema.sql`)

#### 1. `seller` Table
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

#### 2. `product_lineage` Table
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

#### 3. `product` Table Extension
```sql
ALTER TABLE product 
ADD COLUMN listing_type product_listing_type NOT NULL DEFAULT 'FIXED_PRICE';
```
**Enum**: `product_listing_type` = `FIXED_PRICE` | `AUCTION`

### Enums
| Enum Name | Values | Used By |
|-----------|--------|---------|
| `seller_verification_status` | `PENDING`, `VERIFIED` | `seller.verification_status` |
| `product_listing_type` | `FIXED_PRICE`, `AUCTION` | `product.listing_type` |

> `seller.seller_trust` and `seller.seller_category` are **VARCHAR with defaults**, not PostgreSQL enums, so new categories can be added without a migration. Application-level values are documented in `SAMPLE_DATA.md`.

### Helper Views
| View | Purpose |
|------|---------|
| `product_current_owner` | Latest owner of each product (from lineage) |
| `seller_stats` | Aggregated sales count, revenue, last sale per seller |

---

## ⚙️ Configuration

### Configuration File: `medusa-config.js` (NOT `.ts`)

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
  },
}
```

**Intentionally excluded modules:** `rbac` and `workflow-engine-inmemory` are not registered — enabling them causes license/shared-container failures in this setup. Registering modules as an array or with hyphenated keys also breaks loading; `modules` must be an object keyed by valid names (`api_key`, `seller`, `lineage`, ...).

### Environment Variables (`.env`)
```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pawnpawn_db
STORE_CORS=http://localhost:3000,http://localhost:3001
ADMIN_CORS=http://localhost:9000,http://localhost:5173
AUTH_CORS=http://localhost:3000,http://localhost:3001,http://localhost:9000
JWT_SECRET=supersecret
COOKIE_SECRET=supersecret
NODE_ENV=development
```

### CORS Strategy
| Origin | Purpose | Credentials |
|--------|---------|-------------|
| `http://localhost:3000` | Buyer App | ✅ Yes |
| `http://localhost:3001` | Seller App | ✅ Yes |
| `http://localhost:9000` | Medusa Admin | ✅ Yes |
| `http://localhost:5173` | Vite dev (admin) | ✅ Yes |

### Local Runtime Details (verified)

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

## 📦 Package Scripts

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

### Database Commands (via Medusa CLI)
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

# Load PawnPawn sample data (7 sellers, 5 buyers, 17 listings, lineage)
psql -h localhost -U postgres -d pawnpawn_db -v ON_ERROR_STOP=1 -f sql/sample-data.sql
```

**Sample data**: see `documentation/SAMPLE_DATA.md`. Buyer accounts use password `buyer1234`; the store API key is `pk_a6c505481cec4bc82dd9cfcbee017cac5ca0affd31ae65ee78861dcd46bc30e4`.

**Note**: `db:migrate` schema step succeeds ("Database already up-to-date"). Migration scripts step fails with `Cannot read properties of undefined (reading 'acquire')` — this is non-fatal. See `documentation/DB_MIGRATE_WORKAROUND.md`.

---

## 🔄 Core Workflows

> **Status note:** Medusa core routes and the custom module services exist. Admin seller reads (`GET /admin/seller`, `/admin/seller/:id`) and the **Sellers** admin page are implemented; storefront seller/purchase/lineage routes and admin mutations remain planned. See `API.md` → Current Implementation Status.

### 1. Admin Login (Implemented)
```
POST /auth/user/emailpass
  → Body: { email: "admin@pawnpawn.com", password: "supersecret" }
  → Returns: JWT token
  → Use: Authorization: Bearer <token>
```

### 2. Buyer Registration & Login (Implemented)
```
POST /auth/customer/emailpass/register  → auth identity + token
POST /store/customers                   → customer profile (needs publishable key)
POST /auth/customer/emailpass           → login, returns token
```

### 3. Seller Onboarding (Planned — service exists)
```
PLANNED: POST /store/seller/onboard
  → Body: { handle, store_name, avatar_url?, seller_trust?, seller_category? }

CURRENT: sellerService.createSellers({ handle, store_name, razorpay_account_id, ... })
```

### 4. Product Listing (Core read implemented; seller write planned)
```
IMPLEMENTED: GET /store/products, GET /store/products/:id
PLANNED:     POST/PATCH /store/products, auction start/bid
```

### 5. Purchase Flow (Planned)
```
PLANNED: POST /store/purchase
  → would create order + product_lineage entry

CURRENT: lineageService.recordTransfer({ product_id, seller_id?, buyer_id, price })
```

### 6. Lineage Query (Planned REST — module/SQL works)
```
PLANNED: GET /store/products/:id/lineage

CURRENT: lineageService.getLineageHistory(productId)
         lineageService.getCurrentOwner(productId)
```

### 7. Admin Seller Listing (Implemented)

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

## 🔐 Authentication

### Admin Login (Working)
```bash
curl -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pawnpawn.com","password":"supersecret"}'
```

Returns a JWT token. Use it with:
```bash
Authorization: Bearer <jwt_token>
```

### Admin Credentials
| Field | Value |
|-------|-------|
| Email | `admin@pawnpawn.com` |
| Password | `supersecret` |

> **Note**: Admin user already exists in DB (seeded during migration). Password was updated via direct SQL update to `provider_identity.provider_metadata.password`.

### Store API Authentication
- Header: `x-publishable-api-key: <token>` (get from `api_key` table)
- Or: `Authorization: Bearer <jwt_token>`

### Sample Buyer Credentials
All sample buyers use password `buyer1234`. See `SAMPLE_DATA.md`.

---

## 📡 API Endpoints

**Status legend:** `Implemented` = route exists and was exercised; `Planned` = contract only, no route file.

### Auth
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| POST | `/auth/user/emailpass` | No | Admin login | Implemented |
| POST | `/auth/session` | Bearer | Create session from JWT | Implemented |
| GET | `/auth/user/providers` | Bearer | List auth providers | Implemented |
| POST | `/auth/customer/emailpass` | No | Buyer login | Implemented |
| POST | `/auth/customer/emailpass/register` | No | Buyer registration | Implemented |

### Seller
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| POST | `/store/seller/onboard` | No | Register seller | Planned |
| GET | `/store/seller/me` | Bearer/Cookie | Get seller profile | Planned |
| PATCH | `/store/seller/me` | Bearer/Cookie | Update seller profile | Planned |

### Products
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| GET | `/store/products` | Publishable key | List products | Implemented (core) |
| GET | `/store/products/:id` | Publishable key | Get product | Implemented (core) |
| POST | `/store/products` | Bearer/Cookie | Create listing | Planned |
| PATCH | `/store/products/:id` | Bearer/Cookie | Update listing | Planned |
| POST | `/store/products/:id/auction/start` | Bearer/Cookie | Start auction | Planned |
| POST | `/store/products/:id/bid` | Bearer/Cookie | Place bid | Planned |

### Purchase/Lineage
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| POST | `/store/purchase` | Bearer/Cookie | Purchase product | Planned |
| GET | `/store/products/:id/lineage` | No | Ownership history | Planned |

### Custom Module Admin REST
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| GET | `/admin/seller` | Bearer | List/filter sellers | Implemented |
| GET | `/admin/seller/:id` | Bearer | Seller detail | Implemented |
| POST | `/admin/seller` | Bearer | Create seller | Implemented |
| PATCH | `/admin/seller/:id` | Bearer | Update any seller field | Implemented |
| DELETE | `/admin/seller/:id` | Bearer | Deactivate seller (soft-delete) | Implemented |
| GET/POST | `/admin/lineage`, `/admin/lineage/:id` | Bearer | Lineage CRUD | Planned |

### Admin UI
| Route | Description | Status |
|-------|-------------|--------|
| `/app/sellers` | Sellers list page (store, handle, category, trust, verification, bio, social, customer link) | Implemented |

### Custom Module Service Access (Implemented)

```ts
const sellerService = container.resolve("seller")   // not "sellerModuleService"
const lineageService = container.resolve("lineage") // not "lineageModuleService"
```

Seller methods: `findByHandle`, `verifySeller`, `updateRazorpayAccount`, `findTrustedSellers`, `findSellersByCategory`, `updateTrustStatus`, `updateCategory`, `updateSocialMedia`, `updateBio`.

Lineage methods: `recordTransfer`, `getLineageHistory`, `getCurrentOwner`.

Generated CRUD: `listSellers` / `createSellers` / `updateSellers` / `deleteSellers`; `listProductLineages` / `createProductLineages` / `updateProductLineages` / `deleteProductLineages`.

> `MedusaService` has no generic `this.list()` / `this.update()`. `updateSellers` takes `{ id, ...fields }` or `{ selector, data }`.

---

## 🧪 Testing Strategy

- **Unit tests**: `src/**/__tests__/**/*.unit.spec.ts` → `npm run test:unit`
- **Module integration**: `src/modules/*/__tests__/**` → `npm run test:integration:modules`
- **HTTP integration**: `integration-tests/http/*.spec.ts` → `npm run test:integration:http`

---

## 🚀 Quick Start Checklist

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
11. Admin sellers: `GET /admin/seller` with the admin token returns 7 sellers; open `http://localhost:9000/app/sellers`
12. Buyer login: `POST /auth/customer/emailpass` with `sarah.johnson@gmail.com` / `buyer1234`

---

## 📚 References

- [Medusa v2 Documentation](https://docs.medusajs.com)
- [Medusa Framework API](https://docs.medusajs.com/resources/framework)
- [Core Flows Reference](https://docs.medusajs.com/resources/core-flows)
- [Module Development Guide](https://docs.medusajs.com/modules)
- [Workflow Development](https://docs.medusajs.com/workflows)
- [Razorpay Connect Docs](https://razorpay.com/docs/connect/)

---

*Last sync: Oct 2026 — Medusa v2.22.0, custom seller/lineage modules verified, sample data seeded (7 sellers / 5 buyers / 17 products / 8 lineage records), schema aligned to text IDs + Medusa timestamps, admin seller CRUD API + Sellers page implemented, remaining custom REST routes planned*