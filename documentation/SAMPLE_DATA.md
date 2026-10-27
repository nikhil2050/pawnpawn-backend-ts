# Sample Data

The canonical seed represents the celebrity-to-fan marketplace described in [`AI_CONTEXT.md`](./AI_CONTEXT.md#marketplace-architecture-decision-record): 8 sellers, 13 seller-mapped published products/listings, 35 inventory items and levels, 5 buyers, and 8 lineage records. Four upstream Medusa demo products remain as `draft` records without a marketplace seller.

Seeded demo data for local development: Hollywood-celebrity sellers, buyer accounts with working logins, celebrity memorabilia listings, marketplace `Listing` rows, inventory records, and provenance/lineage history.

> **API availability:** listings and buyers are reachable through Medusa core routes (`GET /store/products`, `POST /auth/customer/emailpass`, `POST /store/customers`). Seller data is fully manageable through the admin API (`GET/POST /admin/seller`, `GET/PATCH/DELETE /admin/seller/:id`) and the **Sellers** page in the Medusa Admin at `/app/sellers`. Seller onboarding, seller listing CRUD, admin listing review, and HQ fulfillment transitions are implemented (`POST /store/seller/onboard`, `GET/POST /store/seller/listings`, `PATCH /store/seller/listings/:id`, `GET /store/sellers/:handle`, `GET /admin/listings`, `POST /admin/listings/:id/review`, `GET /admin/seller/:id/listings`, `POST /admin/hq-fulfillments/:id`). `PATCH /store/seller/me`, custom `POST/PATCH /store/products`, `/store/purchase`, `/store/products/:id/lineage`, and `/admin/lineage*` still have no custom REST routes — use the module services (`container.resolve("seller")`, `container.resolve("lineage")`, `container.resolve("listing")`, `container.resolve("hq_fulfillment")`) or SQL. See `API.md` → Current Implementation Status.

## Seed

```bash
cd apps/backend
psql -h localhost -U postgres -d pawnpawn_db -v ON_ERROR_STOP=1 -f sql/sample-data.sql
```

The script is idempotent — safe to run multiple times.

Prerequisite: buyers are registered through the Store API (so they have real `emailpass` credentials). The seed only attaches their shipping metadata and purchase history.

## Environment

| Item | Value |
|------|-------|
| API | `http://localhost:9000` |
| Store API key | `x-publishable-api-key: pk_a6c505481cec4bc82dd9cfcbee017cac5ca0affd31ae65ee78861dcd46bc30e4` |
| Admin login | `admin@pawnpawn.com` / `supersecret` |
| Buyer password | `buyer1234` (all sample buyers) |
| US region | `reg_01M5SSC7P6CPJDG955B1564RQT` (`usd`) |
| India region | `reg_01M5SGFGPPFNFBFRJQAAHRRNVA` (`inr`) |
| Europe region | `reg_01M5J0TH63KAP4HJN34ERGDC5N` (`eur`) |
| Default sales channel | `sc_01M5J0TH4TCBFJ4NJD3T1TEZZ2` |

## Sellers (7)

| Handle | Store | Trust | Category | Notes |
|--------|-------|-------|----------|-------|
| `snoopdogg` | Snoop Dogg Shop | trusted | musician | Studio/music-video items |
| `kimkardashian` | Kim K Archive | trusted | influencer | Red-carpet/designer pieces |
| `dwaynejohnson` | The Rock Collection | trusted | athlete | WWE + screen-used props |
| `rihanna` | Fenty x Rihanna | trusted | musician | Tour outfits |
| `leonardodicaprio` | Leo Eco Collection | trusted | celebrity | Film memorabilia |
| `beyonce` | Beyonce Archive | trusted | musician | Tour costumes |
| `sarah_resells` | Sarah's Closet | **untrusted** | other | Buyer-turned-seller resale |

All sellers are `VERIFIED`. `sarah_resells` demonstrates the difference between verification and trust: a verified buyer can sell, but starts as `untrusted`.

Allowed values: `seller_trust` = `trusted` | `untrusted`; `seller_category` = `celebrity` | `influencer` | `musician` | `athlete` | `other`.

### Viewing sellers in the Medusa Admin

1. Open `http://localhost:9000/app` and sign in with `admin@pawnpawn.com` / `supersecret`.
2. Select **Sellers** in the sidebar (direct URL: `http://localhost:9000/app/sellers`).
3. The page lists all 8 sellers with store, handle, category, trust, verification, bio, social handle, and customer link.

The page calls `GET /admin/seller` with the admin session. The same data is available over REST:

```bash
TOKEN=$(curl -s -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pawnpawn.com","password":"supersecret"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9000/admin/seller?trust=untrusted&category=other"
```

> The Medusa **Customers** page still shows only the 5 buyers. Six celebrity sellers have no `customer_id`; `sarah_resells` is the only seller linked to a buyer account (Sarah Johnson). Sellers are a separate custom module, so they appear on the **Sellers** page instead.

## Buyers (5)

All have working Store API logins (password `buyer1234`).

| Email | Name | City |
|-------|------|------|
| `sarah.johnson@gmail.com` | Sarah Johnson | Los Angeles, CA |
| `mike.chen@outlook.com` | Mike Chen | San Francisco, CA |
| `emily.rodriguez@yahoo.com` | Emily Rodriguez | Miami, FL |
| `james.wilson@icloud.com` | James Wilson | New York, NY |
| `olivia.martinez@gmail.com` | Olivia Martinez | Chicago, IL |

Buyer login:

```bash
curl -s -X POST http://localhost:9000/auth/customer/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.johnson@gmail.com","password":"buyer1234"}'
```

### Re-creating a buyer from scratch

Registration is a two-step flow. The seed assumes these customers already exist.

```bash
PK="pk_a6c505481cec4bc82dd9cfcbee017cac5ca0affd31ae65ee78861dcd46bc30e4"
EMAIL="new.buyer@example.com"

# 1. Create the auth identity; returns { "token": "..." }
TOKEN=$(curl -s -X POST http://localhost:9000/auth/customer/emailpass/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"buyer1234\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 2. Create the customer profile
curl -s -X POST http://localhost:9000/store/customers \
  -H "Content-Type: application/json" \
  -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"email\":\"$EMAIL\",\"first_name\":\"New\",\"last_name\":\"Buyer\"}"
```

Do not `INSERT INTO customer` directly — that skips the `emailpass` identity and the buyer cannot log in.

## Products (17)

12 celebrity listings, 1 buyer-turned-seller resale, plus 4 Medusa demo products.

### Celebrity listings

| Product | Seller | Event / provenance | USD | INR |
|---------|--------|--------------------|-----|-----|
| Snoop Dogg Platinum Chain | snoopdogg | "Gin and Juice" video (1994) | 85,000 | 7,055,000 |
| Snoop Dogg Studio Microphone | snoopdogg | Doggystyle sessions (1993) | 25,000 | 2,075,000 |
| Kim Kardashian Met Gala Dress | kimkardashian | Met Gala (2019) | 120,000 | 9,960,000 |
| Kim Kardashian Sunglasses | kimkardashian | Paris Fashion Week (2019) | 3,500 | 290,500 |
| Dwayne Johnson WWE Championship Belt | dwaynejohnson | WWE title reign (2000) | 95,000 | 7,885,000 |
| Dwayne Johnson Movie Boots | dwaynejohnson | *Hobbs & Shaw* (2019) | 12,000 | 996,000 |
| Rihanna Fenty Stage Outfit | rihanna | Diamonds World Tour (2013) | 65,000 | 5,395,000 |
| Rihanna Fenty Beauty Lipstick Set | rihanna | Fenty launch (2017) | 250 | 20,750 |
| Leonardo DiCaprio Titanic Jacket | leonardodicaprio | *Titanic* (1997) | 42,000 | 3,486,000 |
| Leonardo DiCaprio Oscar Speech Notes | leonardodicaprio | 88th Academy Awards (2016) | 18,000 | 1,494,000 |
| Beyonce Formation Tour Boots | beyonce | Formation World Tour (2016) | 55,000 | 4,565,000 |
| Beyonce Lemonade Dress | beyonce | *Lemonade* visual album (2016) | 38,000 | 3,154,000 |

### Buyer-turned-seller resale

| Product | Seller | Provenance | USD |
|---------|--------|------------|-----|
| Snoop Dogg Signed Doggystyle Vinyl | sarah_resells (untrusted) | Purchased from snoopdogg | 1,500 |

Each product has:

- One variant (`manage_inventory = false`, so it is immediately purchasable)
- USD and INR prices
- Link to the Default Sales Channel
- `metadata` with `seller_id`, `seller_handle`, `seller_name`, `event`, `condition`, `provenance`, `certificate_of_authenticity`
- Placeholder images from `picsum.photos`

## Lineage / purchase history (8 records)

| Product | Seller | Buyer | Price | Date |
|---------|--------|-------|-------|------|
| Snoop Dogg Platinum Chain | snoopdogg | sarah.johnson | 85,000 | 2026-08-14 |
| Snoop Dogg Platinum Chain (resale) | — | olivia.martinez | 92,000 | 2026-09-30 |
| Snoop Dogg Studio Microphone | snoopdogg | mike.chen | 31,000 | 2026-09-02 |
| Kim Kardashian Sunglasses | kimkardashian | emily.rodriguez | 4,200 | 2026-09-20 |
| Dwayne Johnson Movie Boots | dwaynejohnson | james.wilson | 12,500 | 2026-10-01 |
| Rihanna Fenty Beauty Lipstick Set | rihanna | olivia.martinez | 300 | 2026-10-08 |
| Leonardo DiCaprio Titanic Jacket | leonardodicaprio | sarah.johnson | 42,000 | 2026-07-11 |
| Snoop Dogg Signed Doggystyle Vinyl | snoopdogg | sarah.johnson | 1,200 | 2026-09-15 |

Current owner = buyer of the most recent lineage record for a product. For example, the Snoop Dogg Platinum Chain is currently owned by Olivia Martinez.

## Verify

```bash
PK="pk_a6c505481cec4bc82dd9cfcbee017cac5ca0affd31ae65ee78861dcd46bc30e4"
US="reg_01M5SSC7P6CPJDG955B1564RQT"

# All published products
curl -s -H "x-publishable-api-key: $PK" \
  "http://localhost:9000/store/products?limit=100" | python3 -c "import sys,json;print(json.load(sys.stdin)['count'])"

# Product with price + seller metadata
curl -s -H "x-publishable-api-key: $PK" \
  "http://localhost:9000/store/products?handle=snoop-dogg-platinum-chain&region_id=$US&fields=id,title,metadata,*variants,*variants.calculated_price"

# Lineage
psql -h localhost -U postgres -d pawnpawn_db -c \
  "SELECT product_id, seller_id, buyer_id, price, transacted_at FROM product_lineage ORDER BY product_id, transacted_at;"
```

## Verify the custom modules

The seller and lineage services can be exercised end-to-end (including a create/update/delete round-trip) with:

```bash
cd apps/backend
../../node_modules/.bin/medusa exec ./src/scripts/verify-sample-data.ts
```

Expected output:

```text
[seller] total=7 trusted=6 musicians=3
[seller] handles=sarah_resells, leonardodicaprio, rihanna, beyonce, kimkardashian, snoopdogg, dwaynejohnson
[seller] findByHandle(snoopdogg)=Snoop Dogg Shop
[seller] create/update ok: id=01M5SVK... trust=untrusted found=true
[lineage] prod_snoop_001 history=2 currentOwner=cus_01M5SSA...
[lineage] recordTransfer ok: id=01M5SVK... historyNow=3
```

IDs are opaque text. Service-created rows get ULID-like values (`01M5SVK...`); seeded rows may use UUID-shaped text or `seller_*` / `lineage_*` values depending on when the database was first seeded.

The script deletes the temporary seller and lineage rows it creates.

## Reset

```bash
# Remove sample lineage
psql -h localhost -U postgres -d pawnpawn_db -c "DELETE FROM product_lineage;"

# Remove sample listings (variants/prices cascade where configured)
psql -h localhost -U postgres -d pawnpawn_db -c "DELETE FROM product WHERE id LIKE 'prod\_%' AND id NOT LIKE 'prod\_01%';"

# Remove sample sellers
psql -h localhost -U postgres -d pawnpawn_db -c "DELETE FROM seller;"

# Remove sample buyers
psql -h localhost -U postgres -d pawnpawn_db -c "DELETE FROM customer WHERE email LIKE '%@gmail.com' OR email LIKE '%@outlook.com' OR email LIKE '%@yahoo.com' OR email LIKE '%@icloud.com';"
```

> Images are placeholders and prices/events are illustrative, not real market valuations.
