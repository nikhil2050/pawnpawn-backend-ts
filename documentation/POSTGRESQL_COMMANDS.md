# PostgreSQL Commands Reference — PawnPawn Backend

Marketplace ownership and lifecycle are defined in [`AI_CONTEXT.md`](./AI_CONTEXT.md#marketplace-architecture-decision-record). Query `listing` for current seller/product assignment; use `product_lineage` for historical ownership and `hq_fulfillment` for HQ processing. Do not use product metadata as the authoritative relationship.

> **Purpose**: Quick-reference cheat sheet for PostgreSQL operations specific to the PawnPawn marketplace backend.
> **Location**: `/documentation/POSTGRESQL_COMMANDS.md`
> **Database**: `pawnpawn_db`
> **Connection**: `postgres://postgres:postgres@localhost:5432/pawnpawn_db`

---

## 1. Database Setup & Connection

### Create the database
```bash
createdb -h localhost -U postgres pawnpawn_db
```

### Connect to the database
```bash
psql -h localhost -U postgres -d pawnpawn_db
```

### Connect via connection string
```bash
psql "postgres://postgres:postgres@localhost:5432/pawnpawn_db"
```

### List all databases
```bash
psql -h localhost -U postgres -l
```

### Drop the database (use with caution)
```bash
dropdb -h localhost -U postgres pawnpawn_db
```

---

## 2. Schema Import (Custom Tables)

### Import our custom schema via the npm script
```bash
cd apps/backend
npm run db:import
```

### Import schema.sql directly via psql
```bash
psql -h localhost -U postgres -d pawnpawn_db -f sql/schema.sql
```

### Verify custom tables were created
```sql
\dt
-- Expected output includes: seller, product_lineage
-- (product table is managed by Medusa migrations)
```

### Verify enums were created
```sql
SELECT t.typname AS enum_name, e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname IN ('seller_verification_status', 'product_listing_type')
ORDER BY t.typname, e.enumsortorder;
```

### Verify product.listing_type column
```sql
\d product
-- Look for: listing_type product_listing_type NOT NULL DEFAULT 'FIXED_PRICE'
```

---

## 3. Table Schemas

### seller table
```sql
\d seller
```

### product_lineage table
```sql
\d product_lineage
```

### product table (Medusa-managed, with our extension)
```sql
\d product
```

### Helper views
```sql
\d product_current_owner
\d seller_stats
```

### Medusa compatibility requirements

Custom module tables must follow Medusa's conventions or the generated service queries fail:

| Requirement | Why |
|-------------|-----|
| `id TEXT PRIMARY KEY` | Medusa generates text IDs (ULIDs); a UUID-typed column rejects them. Seeded rows may use `seller_*` / `lineage_*` or UUID-shaped text |
| `created_at TIMESTAMPTZ DEFAULT NOW()` | Added/queried by `MedusaService` |
| `updated_at TIMESTAMPTZ DEFAULT NOW()` | Added/queried by `MedusaService` |
| `deleted_at TIMESTAMPTZ` | Generated list queries filter `deleted_at IS NULL` |
| `seller.customer_id VARCHAR(255)` | Optional link to a buyer-turned-seller account |

> Legacy databases created `seller.razorpay_account_id` as `NOT NULL`. `schema.sql` now drops that constraint (`ALTER COLUMN ... DROP NOT NULL`) so a seller can be created before Razorpay Connect onboarding, matching the model.

If `db:import` fails with `cannot alter type of a column used by a view`, drop the views first (`product_current_owner`, `seller_stats`) — `schema.sql` already does this in its compatibility block.

### Sample data verification

```sql
-- Counts after seeding
SELECT 'sellers' AS entity, COUNT(*) FROM seller
UNION ALL SELECT 'buyers',    COUNT(*) FROM customer
UNION ALL SELECT 'products',  COUNT(*) FROM product
UNION ALL SELECT 'lineage',   COUNT(*) FROM product_lineage;

-- Trusted vs untrusted
SELECT seller_trust, seller_category, COUNT(*)
FROM seller
GROUP BY seller_trust, seller_category
ORDER BY seller_trust, seller_category;

-- Current owners
SELECT * FROM product_current_owner ORDER BY product_id;
```

---

## 4. Seller Table Operations

### Insert a new seller
```sql
INSERT INTO seller
  (id, handle, store_name, avatar_url, razorpay_account_id, verification_status,
   seller_trust, seller_category, social_media_handle, bio)
VALUES
  ('seller_' || replace(gen_random_uuid()::text, '-', ''),
   'rajesh_jewelers', 'Rajesh Jewelers', 'https://cdn.pawnpawn.com/avatars/rajesh.jpg',
   'ra_connect_rajesh_001', 'PENDING', 'untrusted', 'other', '@rajeshjewelers',
   'Family jeweler reselling authenticated pieces from a private collection.')
RETURNING *;
```

`id` has no database default — Medusa generates text IDs (`seller_...`), so supply one when inserting manually. `razorpay_account_id` is nullable but unique when provided; this example sets it. In application code, use `sellerService.createSellers(...)` and let Medusa generate the ID.

### Update seller verification status
```sql
UPDATE seller
SET verification_status = 'VERIFIED', updated_at = NOW()
WHERE handle = 'rajesh_jewelers';
```

### Update seller trust and category
```sql
UPDATE seller
SET seller_trust = 'trusted',
    seller_category = 'musician',
    updated_at = NOW()
WHERE handle = 'rajesh_jewelers';
```

### Find trusted celebrity sellers
```sql
SELECT id, handle, store_name, seller_category, social_media_handle
FROM seller
WHERE seller_trust = 'trusted'
  AND seller_category IN ('celebrity', 'influencer', 'musician', 'athlete')
ORDER BY store_name;
```

### Find sellers by category
```sql
SELECT id, handle, store_name, seller_trust, verification_status
FROM seller
WHERE seller_category = 'musician'
ORDER BY store_name;
```

### Find buyer-turned-sellers (untrusted)
```sql
SELECT id, handle, store_name, seller_category, bio
FROM seller
WHERE seller_trust = 'untrusted'
ORDER BY created_at DESC;
```

### Update Razorpay account ID
```sql
UPDATE seller
SET razorpay_account_id = 'ra_connect_1234567890', updated_at = NOW()
WHERE handle = 'snoopdogg';
```
(IDs are text and generated by Medusa — prefer `handle`, or paste the actual `seller_...` ID.)

### Find unverified sellers
```sql
SELECT id, handle, store_name, seller_trust, seller_category, verification_status, created_at
FROM seller
WHERE verification_status = 'PENDING'
ORDER BY created_at;
```

### Find seller by Razorpay account ID (for webhooks)
```sql
SELECT * FROM seller WHERE razorpay_account_id = 'ra_connect_1234567890';
```

### Seller trust / category counts
```sql
SELECT seller_trust, seller_category, COUNT(*) AS sellers
FROM seller
GROUP BY seller_trust, seller_category
ORDER BY seller_trust, seller_category;
```

### Get seller statistics (via view)
```sql
SELECT * FROM seller_stats ORDER BY total_revenue DESC;
```

---

## 5. Product Lineage Operations

### Insert a lineage entry (after purchase)
```sql
INSERT INTO product_lineage (id, product_id, seller_id, buyer_id, price, transacted_at)
VALUES (
  'lineage_' || replace(gen_random_uuid()::text, '-', ''),
  'prod_snoop_001',
  (SELECT id FROM seller WHERE handle = 'snoopdogg'),
  (SELECT id FROM customer WHERE email = 'sarah.johnson@gmail.com'),
  2500.00,
  NOW()
)
RETURNING *;
```

`id` has no database default (Medusa text IDs), so supply one. `seller_id` may be `NULL` for a buyer-to-buyer resale.

### Get full lineage for a product
```sql
SELECT pl.id, pl.product_id, pl.seller_id, s.store_name AS seller_name,
       pl.buyer_id, pl.price, pl.transacted_at
FROM product_lineage pl
LEFT JOIN seller s ON pl.seller_id = s.id
WHERE pl.product_id = 'prod_snoop_001'
ORDER BY pl.transacted_at ASC;
```

Use `LEFT JOIN` so buyer-to-buyer resales (`seller_id IS NULL`) still appear.

### Get current owner of each product (via view)
```sql
SELECT * FROM product_current_owner;
```

### Get all sales by a seller
```sql
SELECT pl.id, pl.product_id, p.title, pl.buyer_id, pl.price, pl.transacted_at
FROM product_lineage pl
JOIN product p ON pl.product_id = p.id
WHERE pl.seller_id = (SELECT id FROM seller WHERE handle = 'snoopdogg')
ORDER BY pl.transacted_at DESC;
```

### Get purchase history for a buyer
```sql
SELECT pl.id, pl.product_id, p.title, pl.seller_id, s.store_name AS seller_name,
       pl.price, pl.transacted_at
FROM product_lineage pl
JOIN product p ON pl.product_id = p.id
LEFT JOIN seller s ON pl.seller_id = s.id
WHERE pl.buyer_id = (SELECT id FROM customer WHERE email = 'sarah.johnson@gmail.com')
ORDER BY pl.transacted_at DESC;
```

### Get all lineage rows with product and buyer details
```sql
SELECT pl.id, p.title, pl.seller_id, c.email AS buyer_email, pl.price, pl.transacted_at
FROM product_lineage pl
JOIN product p ON p.id = pl.product_id
LEFT JOIN customer c ON c.id = pl.buyer_id
ORDER BY pl.transacted_at DESC;
```

---

## 6. Product Listing Type Operations

> `product` has no `price` or `seller_id` column. Prices live in `price` (via `price_set` + variants), and the seller link is stored in `product.metadata` (`seller_id`, `seller_handle`).

### List all FIXED_PRICE products
```sql
SELECT id, title, listing_type, metadata->>'seller_handle' AS seller_handle
FROM product
WHERE listing_type = 'FIXED_PRICE'
ORDER BY title;
```

### List all AUCTION products
```sql
SELECT id, title, listing_type, metadata->>'seller_handle' AS seller_handle
FROM product
WHERE listing_type = 'AUCTION'
ORDER BY title;
```

### Update a product's listing type
```sql
UPDATE product
SET listing_type = 'AUCTION'::product_listing_type,
    updated_at = NOW()
WHERE id = 'prod_snoop_002';
```

### Count products by listing type
```sql
SELECT listing_type, COUNT(*) AS product_count
FROM product
GROUP BY listing_type;
```

---

## 7. Admin User & Auth

### Check existing admin users
```sql
SELECT id, email FROM "user" LIMIT 5;
```

### Check auth provider identities
```sql
SELECT u.email, ai.id AS auth_identity_id, pi.provider, pi.entity_id
FROM "user" u
JOIN auth_identity ai ON (ai.app_metadata->>'user_id') = u.id
JOIN provider_identity pi ON pi.auth_identity_id = ai.id
WHERE u.email = 'admin@pawnpawn.com';
```

### Update admin password (direct SQL, using scrypt-kdf hash)
```sql
-- Generate hash first with: node -e "const scrypt=require('scrypt-kdf'); scrypt.kdf('supersecret',{logN:15,r:8,p:1}).then(h=>console.log(h.toString('base64')))"
-- Then update:
UPDATE provider_identity
SET provider_metadata = jsonb_set(provider_metadata, '{password}', '"<new_hash_base64>"'::jsonb)
WHERE entity_id = 'admin@pawnpawn.com' AND provider = 'emailpass';
```

### Get publishable API key for store API testing
```sql
SELECT token FROM api_key WHERE type = 'publishable' AND deleted_at IS NULL LIMIT 1;
```

---

## 8. Maintenance & Diagnostics

### Check database size
```sql
SELECT pg_size_pretty(pg_database_size('pawnpawn_db'));
```

### Check table sizes
```sql
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check active connections
```sql
SELECT pid, usename, application_name, client_addr, state, query_start
FROM pg_stat_activity
WHERE datname = 'pawnpawn_db';
```

### Terminate a connection
```sql
SELECT pg_terminate_backend(<pid>);
```

### Vacuum and analyze tables
```sql
VACUUM ANALYZE seller;
VACUUM ANALYZE product_lineage;
VACUUM ANALYZE product;
```

### Reindex
```sql
REINDEX TABLE seller;
REINDEX TABLE product_lineage;
```

---

## 9. Backup & Restore

### Backup entire database
```bash
pg_dump -h localhost -U postgres pawnpawn_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Backup specific tables only
```bash
pg_dump -h localhost -U postgres -t seller -t product_lineage pawnpawn_db > custom_tables_backup.sql
```

### Restore from backup
```bash
psql -h localhost -U postgres -d pawnpawn_db -f backup_file.sql
```

---

## 10. User & Permissions

### Create a dedicated app user (recommended for production)
```sql
CREATE USER pawnpawn_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE pawnpawn_db TO pawnpawn_app;
GRANT USAGE ON SCHEMA public TO pawnpawn_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pawnpawn_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pawnpawn_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pawnpawn_app;
```

### Change password
```sql
ALTER USER pawnpawn_app WITH PASSWORD 'new_password';
```

---

## 11. Common psql Meta-Commands

| Command | Description |
|---------|-------------|
| `\l` | List databases |
| `\c dbname` | Connect to a database |
| `\dt` | List tables |
| `\d tablename` | Describe a table |
| `\du` | List users/roles |
| `\df` | List functions |
| `\dn` | List schemas |
| `\q` | Quit psql |
| `\i filename.sql` | Run a SQL file |
| `\e` | Open editor for last query |
| `\x` | Toggle expanded output |

---

## 12. Troubleshooting

### Connection refused
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql@15

# Start PostgreSQL (Linux)
sudo systemctl start postgresql
```

### Permission denied on schema
```sql
GRANT USAGE ON SCHEMA public TO your_user;
```

### Enum type not found
```bash
# Re-run schema import (enums use IF NOT EXISTS)
npm run db:import
```

### Column listing_type not found on product
```bash
# Ensure Medusa migrations have run first (creates product table)
../../node_modules/.bin/medusa db:migrate

# Then import our schema
npm run db:import
```

### Slow queries on lineage
```sql
-- Add missing index
CREATE INDEX IF NOT EXISTS idx_product_lineage_product_seller ON product_lineage(product_id, seller_id);
ANALYZE product_lineage;
```

---

## 13. One-Liner Cheat Sheet

```bash
# Connect
psql "postgres://postgres:postgres@localhost:5432/pawnpawn_db"

# Import custom schema
psql "postgres://postgres:postgres@localhost:5432/pawnpawn_db" -f sql/schema.sql

# List custom tables
psql "postgres://postgres:postgres@localhost:5432/pawnpawn_db" -c "\dt seller product_lineage"

# Check lineage for a product
psql "postgres://postgres:postgres@localhost:5432/pawnpawn_db" -c "SELECT * FROM product_current_owner;"

# Check seller stats
psql "postgres://postgres:postgres@localhost:5432/pawnpawn_db" -c "SELECT * FROM seller_stats;"

# Get publishable API key
psql "postgres://postgres:postgres@localhost:5432/pawnpawn_db" -c "SELECT token FROM api_key WHERE type='publishable' AND deleted_at IS NULL LIMIT 1;"
```

---

## 🍵 Java Developer Cheat Sheet — PostgreSQL & JDBC Concepts

If you're coming from Java/JDBC/Hibernate, here's a mapping:

| Java/JDBC Concept | PostgreSQL / psql Equivalent | Notes |
|-------------------|------------------------------|-------|
| `DriverManager.getConnection(url, user, pass)` | `psql -h host -U user -d db` | Connect to database |
| `Connection` | `psql` session | A single database session |
| `Statement.executeUpdate(sql)` | `psql -c "SQL"` | Execute a SQL statement |
| `ResultSet` | Query output in terminal | Rows returned by SELECT |
| `PreparedStatement` | psql with parameterized queries | Use `$1`, `$2` for parameters |
| `Connection.commit()` | `COMMIT` | Commit a transaction |
| `Connection.rollback()` | `ROLLBACK` | Roll back a transaction |
| `Connection.setAutoCommit(false)` | `BEGIN` | Start a transaction |
| `@Entity` + `@Table(name="seller")` | `CREATE TABLE seller (...)` | DDL creates tables |
| `@Id` | `PRIMARY KEY` | Primary key constraint |
| `@GeneratedValue` | `id TEXT PRIMARY KEY` (Medusa-generated) | Medusa generates text IDs, not UUIDs |
| `@Column(unique = true)` | `UNIQUE` constraint | Uniqueness constraint |
| `@ManyToOne` + `@JoinColumn` | `REFERENCES seller(id)` | Foreign key relationship |
| `@Enumerated(EnumType.STRING)` | PostgreSQL `ENUM` type | `seller_verification_status` |
| `@CreatedDate` / `@LastModifiedDate` | `DEFAULT NOW()` | Auto-managed timestamps |
| `BigDecimal` | `DECIMAL(12, 2)` | Fixed-precision decimal |
| `java.time.Instant` / `Timestamp` | `TIMESTAMPTZ` | Timestamp with time zone |
| `String` | `VARCHAR(n)` | Variable-length string |
| `int` / `Integer` | `INTEGER` | Whole number |
| `boolean` | `BOOLEAN` | True/false |
| `DROP TABLE` | `DROP TABLE IF EXISTS` | Remove a table (destructive!) |
| `ALTER TABLE ADD COLUMN` | `ALTER TABLE ... ADD COLUMN` | Modify existing table |
| `CREATE INDEX` | `CREATE INDEX IF NOT EXISTS` | Index for query performance |
| `ANALYZE table` | `ANALYZE` | Update table statistics |
| `VACUUM ANALYZE` | `VACUUM ANALYZE` | Reclaim storage + update stats |

---

*Keep this file updated as the schema evolves. Last sync: Oct 2026 — Medusa v2.22.0, text-ID custom tables with Medusa timestamps, seller trust/category fields, Listing and HQ fulfillment tables, sample data (8 sellers / 5 buyers / 17 products / 13 listings / 35 inventory levels / 8 lineage rows).*
