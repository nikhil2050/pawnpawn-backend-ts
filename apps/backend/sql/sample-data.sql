-- ============================================================================
-- PawnPawn Sample Data
-- ----------------------------------------------------------------------------
-- Adds:
--   * Product variants + USD/INR prices for the 14 celebrity listings
--   * Default sales-channel links so the Store API returns them
--   * Seller metadata on products (seller_id / seller_handle / provenance)
--   * Product lineage (previous owners / purchase history)
--
-- Sellers and buyers are created separately:
--   * Sellers: see the INSERT block at the bottom of this file
--   * Buyers : registered through the Store API so they have working logins
--              (password: buyer1234)
--
-- Safe to re-run: every insert is guarded / idempotent.
-- Run from apps/backend:
--   psql -h localhost -U postgres -d pawnpawn_db -f sql/sample-data.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Celebrity sellers (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO seller
  (id, handle, store_name, avatar_url, razorpay_account_id, seller_trust,
   seller_category, social_media_handle, bio, verification_status, created_at, updated_at)
VALUES
  ('seller_snoopdogg', 'snoopdogg', 'Snoop Dogg Shop', 'https://picsum.photos/seed/snoopdogg/400/400',
   'ra_connect_snoop_001', 'trusted', 'musician', '@snoopdogg',
   'Legendary rapper and entrepreneur. Selling items from music videos, studio sessions and world tours.',
   'VERIFIED', NOW(), NOW()),
  ('seller_kimkardashian', 'kimkardashian', 'Kim K Archive', 'https://picsum.photos/seed/kimkardashian/400/400',
   'ra_connect_kim_002', 'trusted', 'influencer', '@kimkardashian',
   'Media personality and entrepreneur. Selling designer pieces from red-carpet and runway appearances.',
   'VERIFIED', NOW(), NOW()),
  ('seller_dwaynejohnson', 'dwaynejohnson', 'The Rock Collection', 'https://picsum.photos/seed/dwaynejohnson/400/400',
   'ra_connect_dwayne_003', 'trusted', 'athlete', '@therock',
   'Former WWE champion and Hollywood actor. Selling screen-used props and championship memorabilia.',
   'VERIFIED', NOW(), NOW()),
  ('seller_rihanna', 'rihanna', 'Fenty x Rihanna', 'https://picsum.photos/seed/rihanna/400/400',
   'ra_connect_rihanna_004', 'trusted', 'musician', '@rihanna',
   'Singer, songwriter and Fenty founder. Selling stage outfits and tour-worn pieces.',
   'VERIFIED', NOW(), NOW()),
  ('seller_leonardodicaprio', 'leonardodicaprio', 'Leo Eco Collection', 'https://picsum.photos/seed/leonardodicaprio/400/400',
   'ra_connect_leo_005', 'trusted', 'celebrity', '@leonardodicaprio',
   'Academy Award winner and environmentalist. Selling memorabilia from iconic film roles.',
   'VERIFIED', NOW(), NOW()),
  ('seller_beyonce', 'beyonce', 'Beyonce Archive', 'https://picsum.photos/seed/beyonce/400/400',
   'ra_connect_beyonce_006', 'trusted', 'musician', '@beyonce',
   'Grammy-winning artist. Selling tour costumes and personal memorabilia.',
   'VERIFIED', NOW(), NOW()),
  ('seller_karanjohar', 'karanjohar', 'Karan Johar Archive', 'https://picsum.photos/seed/karanjohar/400/400',
   'ra_connect_karan_008', 'trusted', 'celebrity', '@karanjohar',
   'Filmmaker and style icon sharing pieces from landmark premieres and film sets.',
   'VERIFIED', NOW(), NOW()),
  ('seller_katewinslet', 'katewinslet', 'Kate Winslet Archive', 'https://picsum.photos/seed/katewinslet/400/400',
   'ra_connect_kate_009', 'trusted', 'celebrity', '@kate.winslet.official',
   'Actor-curated screen and red-carpet memorabilia with documented provenance.',
   'VERIFIED', NOW(), NOW()),
  -- Buyer-turned-seller: purchased from Snoop Dogg, now resells from her archive
  ('seller_sarah_resells', 'sarah_resells', 'Sarah''s Closet', 'https://picsum.photos/seed/sarahresells/400/400',
   'ra_connect_sarah_007', 'untrusted', 'other', '@sarahj',
   'Verified buyer and collector reselling pieces from her personal archive. Purchased from trusted celebrity sellers on PawnPawn.',
   'VERIFIED', NOW(), NOW())
ON CONFLICT (handle) DO UPDATE SET
  store_name          = EXCLUDED.store_name,
  avatar_url          = EXCLUDED.avatar_url,
  seller_trust        = EXCLUDED.seller_trust,
  seller_category     = EXCLUDED.seller_category,
  social_media_handle = EXCLUDED.social_media_handle,
  bio                 = EXCLUDED.bio,
  verification_status = EXCLUDED.verification_status,
  updated_at          = NOW();

-- Link the buyer-turned-seller to Sarah's customer account
UPDATE seller
   SET customer_id = (SELECT id FROM customer WHERE email = 'sarah.johnson@gmail.com'),
       updated_at = NOW()
 WHERE handle = 'sarah_resells'
   AND (SELECT id FROM customer WHERE email = 'sarah.johnson@gmail.com') IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Variants, prices, sales-channel links and seller metadata
-- Listing type is stored in the custom Listing module; this seed deliberately
-- does not add marketplace columns to Medusa's native product table.
-- See documentation/AI_CONTEXT.md §4.2 and §5.3.
-- ---------------------------------------------------------------------------

-- One resale listing from the buyer-turned-seller
INSERT INTO product (id, title, handle, description, status, created_at, updated_at)
VALUES
  ('prod_sarah_001', 'Snoop Dogg Signed Doggystyle Vinyl', 'snoop-dogg-signed-doggystyle-vinyl',
   'Original Doggystyle vinyl signed by Snoop Dogg. Purchased from Snoop Dogg''s official PawnPawn store and resold from a private collection.',
   'published', NOW(), NOW()),
  ('prod_karan_001', 'Karan Johar Fall Drop Velvet Jacket', 'karan-johar-fall-velvet-jacket',
   'Bespoke velvet dinner jacket worn by Karan Johar at a fall film premiere.',
   'published', NOW(), NOW()),
  ('prod_kate_001', 'Kate Winslet Premiere Heels', 'kate-winslet-premiere-heels',
   'Evening heels worn by Kate Winslet during a major film premiere.',
   'published', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  r              RECORD;
  v_variant_id   TEXT;
  v_pset_id      TEXT;
  v_pvps_id      TEXT;
  v_sc_id        TEXT := 'sc_01M5J0TH4TCBFJ4NJD3T1TEZZ2';
  -- The Seller module accepts opaque text IDs. Older fixtures include UUIDs
  -- while canonical seed rows use stable text IDs. See documentation/AI_CONTEXT.md §4.3.
  v_seller_id    TEXT;
  v_seller_name  TEXT;
  v_usd          NUMERIC;
  v_inr          NUMERIC;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('prod_snoop_001',   'snoopdogg',       'One Size', 85000,  'snoop-dogg-platinum-chain',
       'Gin and Juice music video (1994)',                'Excellent', 'Original platinum chain with diamond pendant worn on set.'),
      ('prod_snoop_002',   'snoopdogg',       'One Size', 25000,  'snoop-dogg-studio-mic',
       'Doggystyle album sessions (1993)',                'Good',      'Vintage studio microphone used during the Doggystyle recording sessions.'),
      ('prod_kim_001',     'kimkardashian',   'One Size', 120000, 'kim-k-met-gala-dress',
       'Met Gala (2019)',                                 'Excellent', 'Iconic crystal-covered gown worn on the 2019 Met Gala red carpet.'),
      ('prod_kim_002',     'kimkardashian',   'One Size', 3500,   'kim-k-sunglasses',
       'Paris Fashion Week (2019)',                       'Very Good', 'Designer sunglasses from Kim''s personal collection.'),
      ('prod_therock_001', 'dwaynejohnson',   'One Size', 95000,  'dwayne-johnson-wwe-belt',
       'WWE Championship reign (2000)',                   'Excellent', 'WWE Championship belt carried during The Rock''s title reign.'),
      ('prod_therock_002', 'dwaynejohnson',   'US 12',   12000,  'dwayne-johnson-movie-boots',
       'Hobbs & Shaw (2019)',                             'Good',      'Combat boots worn on screen in Hobbs & Shaw.'),
      ('prod_rihanna_001', 'rihanna',         'US 6',    65000,  'rihanna-fenty-stage-outfit',
       'Diamonds World Tour (2013)',                      'Excellent', 'Custom Swarovski-crystal stage outfit from the Diamonds World Tour.'),
      ('prod_rihanna_002', 'rihanna',         'One Size', 250,    'rihanna-fenty-lipstick',
       'Fenty Beauty launch (2017)',                      'New',       'Limited-edition Fenty Beauty lipstick set, personally signed.'),
      ('prod_leonardo_001','leonardodicaprio', 'US M',    42000,  'leonardo-dicaprio-titanic-jacket',
       'Titanic (1997)',                                  'Very Good', 'Screen-used jacket from the role of Jack Dawson.'),
      ('prod_leonardo_002','leonardodicaprio', 'One Size', 18000, 'leonardo-dicaprio-oscar-notes',
       '88th Academy Awards (2016)',                      'Excellent', 'Handwritten notes from the 2016 Oscar acceptance speech.'),
      ('prod_beyonce_001', 'beyonce',         'US 8',    55000,  'beyonce-formation-boots',
       'Formation World Tour (2016)',                     'Excellent', 'Custom stage boots worn during the Formation World Tour.'),
      ('prod_beyonce_002', 'beyonce',         'US S',    38000,  'beyonce-lemonade-dress',
       'Lemonade visual album (2016)',                    'Excellent', 'Yellow dress worn in the Lemonade visual album.'),
      ('prod_karan_001',   'karanjohar',      'One Size', 65000, 'karan-johar-fall-velvet-jacket',
       'Karan Johar Fall Drop (2026)',                    'Excellent', 'Bespoke velvet dinner jacket from Karan Johar''s fall drop.'),
      ('prod_kate_001',    'katewinslet',     'EU 39',    48000, 'kate-winslet-premiere-heels',
       'Film premiere (2026)',                            'Like New',  'Evening heels worn at a major film premiere.'),
      ('prod_sarah_001',   'sarah_resells',   'One Size', 1500,   'snoop-dogg-signed-doggystyle-vinyl',
       'Purchased from Snoop Dogg (2026)',                'Very Good', 'Signed Doggystyle vinyl purchased from Snoop Dogg''s official store, resold by a verified buyer.')
    ) AS t(product_id, seller_handle, variant_title, price_usd, seed, event_name, condition, provenance)
  LOOP
    v_usd := r.price_usd;
    v_inr := ROUND(r.price_usd * 83, 2);

    SELECT id, store_name INTO v_seller_id, v_seller_name
      FROM seller WHERE handle = r.seller_handle;

    -- Only create variant/price if the product has none yet
    IF NOT EXISTS (
      SELECT 1 FROM product_variant WHERE product_id = r.product_id AND deleted_at IS NULL
    ) THEN
      v_variant_id := 'variant_' || r.product_id;
      v_pset_id    := 'pset_' || r.product_id;
      v_pvps_id    := 'pvps_' || r.product_id;

      INSERT INTO product_variant
        (id, title, sku, allow_backorder, manage_inventory, variant_rank,
         product_id, metadata, created_at, updated_at)
      VALUES
        (v_variant_id, r.variant_title, UPPER(REPLACE(r.product_id, 'prod_', '')) || '-001',
         TRUE, FALSE, 0, r.product_id,
         jsonb_build_object('condition', r.condition), NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO price_set (id, created_at, updated_at)
      VALUES (v_pset_id, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO product_variant_price_set
        (variant_id, price_set_id, id, created_at, updated_at)
      VALUES (v_variant_id, v_pset_id, v_pvps_id, NOW(), NOW())
      ON CONFLICT (variant_id, price_set_id) DO NOTHING;

      INSERT INTO price
        (id, title, price_set_id, currency_code, raw_amount, rules_count,
         amount, created_at, updated_at)
      VALUES
        ('price_usd_' || r.product_id, NULL, v_pset_id, 'usd',
         jsonb_build_object('value', TRIM(TO_CHAR(v_usd, 'FM999999990.00')), 'precision', 20),
         0, v_usd, NOW(), NOW()),
        ('price_inr_' || r.product_id, NULL, v_pset_id, 'inr',
         jsonb_build_object('value', TRIM(TO_CHAR(v_inr, 'FM999999990.00')), 'precision', 20),
         0, v_inr, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    END IF;

    -- Link to the Default Sales Channel so /store/products returns it
    INSERT INTO product_sales_channel
      (product_id, sales_channel_id, id, created_at, updated_at)
    VALUES
      (r.product_id, v_sc_id, 'prodsc_' || r.product_id, NOW(), NOW())
    ON CONFLICT (product_id, sales_channel_id) DO NOTHING;

    -- Attach seller + provenance metadata to the product
    UPDATE product
       SET thumbnail  = COALESCE(thumbnail, 'https://picsum.photos/seed/' || r.seed || '/800/800'),
           metadata   = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
             'seller_id',     v_seller_id::text,
             'seller_handle', r.seller_handle,
             'seller_name',   v_seller_name,
             'event',         r.event_name,
             'condition',     r.condition,
             'provenance',    r.provenance,
             'certificate_of_authenticity', TRUE
           ),
           updated_at = NOW()
     WHERE id = r.product_id;
  END LOOP;
END $$;

-- Use native Medusa taxonomy and collection relations for the two investor
-- demo drops; marketplace ownership remains solely on their Listing records.
-- See documentation/AI_CONTEXT.md §4.2 and §5.3.
UPDATE product
   SET collection_id = 'pcol_fall_drop', updated_at = NOW()
 WHERE id = 'prod_karan_001';
UPDATE product
   SET collection_id = 'pcol_01M5R49FDC4K1SATPFKVGQ08MT', updated_at = NOW()
 WHERE id = 'prod_kate_001';
INSERT INTO product_category_product (product_id, product_category_id)
SELECT mapping.product_id, category.id
FROM (VALUES ('prod_karan_001', 'pcat_outerwear'), ('prod_kate_001', 'pcat_footwear'))
  AS mapping(product_id, category_id)
JOIN product_category category ON category.id = mapping.category_id
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Buyer shipping metadata (buyers themselves are created via Store API)
-- ---------------------------------------------------------------------------
UPDATE customer SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'city', 'Los Angeles', 'state', 'CA', 'country', 'US',
    'address_1', '1200 Sunset Blvd', 'postal_code', '90026')
WHERE email = 'sarah.johnson@gmail.com';

UPDATE customer SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'city', 'San Francisco', 'state', 'CA', 'country', 'US',
    'address_1', '500 Market St', 'postal_code', '94105')
WHERE email = 'mike.chen@outlook.com';

UPDATE customer SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'city', 'Miami', 'state', 'FL', 'country', 'US',
    'address_1', '800 Ocean Dr', 'postal_code', '33139')
WHERE email = 'emily.rodriguez@yahoo.com';

UPDATE customer SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'city', 'New York', 'state', 'NY', 'country', 'US',
    'address_1', '350 5th Ave', 'postal_code', '10118')
WHERE email = 'james.wilson@icloud.com';

UPDATE customer SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'city', 'Chicago', 'state', 'IL', 'country', 'US',
    'address_1', '233 S Wacker Dr', 'postal_code', '60606')
WHERE email = 'olivia.martinez@gmail.com';

-- ---------------------------------------------------------------------------
-- 4. Product lineage / purchase history
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_buyer TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('prod_snoop_001',   'snoopdogg',       'sarah.johnson@gmail.com',   85000.00, TIMESTAMP '2026-08-14 14:30:00'),
      ('prod_snoop_001',   NULL,             'olivia.martinez@gmail.com', 92000.00, TIMESTAMP '2026-09-30 11:00:00'),
      ('prod_snoop_002',   'snoopdogg',       'mike.chen@outlook.com',     31000.00, TIMESTAMP '2026-09-02 18:15:00'),
      ('prod_kim_002',     'kimkardashian',   'emily.rodriguez@yahoo.com',  4200.00, TIMESTAMP '2026-09-20 12:00:00'),
      ('prod_therock_002', 'dwaynejohnson',   'james.wilson@icloud.com',   12500.00, TIMESTAMP '2026-10-01 09:45:00'),
      ('prod_rihanna_002', 'rihanna',         'olivia.martinez@gmail.com',   300.00, TIMESTAMP '2026-10-08 16:20:00'),
      ('prod_leonardo_001','leonardodicaprio', 'sarah.johnson@gmail.com',  42000.00, TIMESTAMP '2026-07-11 13:00:00'),
      ('prod_sarah_001',   'snoopdogg',       'sarah.johnson@gmail.com',   1200.00, TIMESTAMP '2026-09-15 10:00:00')
    ) AS t(product_id, seller_handle, buyer_email, price, transacted_at)
  LOOP
    SELECT id INTO v_buyer FROM customer WHERE email = r.buyer_email;
    IF v_buyer IS NULL THEN
      RAISE NOTICE 'Skipping lineage for %: buyer % not found', r.product_id, r.buyer_email;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM product_lineage
       WHERE product_id = r.product_id AND buyer_id = v_buyer
    ) THEN
      INSERT INTO product_lineage
        (id, product_id, seller_id, buyer_id, price, transacted_at)
      VALUES
        ('lineage_' || MD5(r.product_id || '|' || r.buyer_email || '|' || r.transacted_at::text),
         r.product_id,
         CASE WHEN r.seller_handle IS NULL THEN NULL
              ELSE (SELECT id FROM seller WHERE handle = r.seller_handle) END,
         v_buyer, r.price, r.transacted_at);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Marketplace listings and inventory
-- ---------------------------------------------------------------------------
-- Each celebrity/resale product gets one Listing. Listing is the normalized
-- seller relationship; product.metadata remains useful for storefront display.
INSERT INTO listing
  (id, seller_id, product_id, listing_status, listing_type, item_condition, created_at, updated_at)
SELECT
  'listing_' || p.id,
  (p.metadata->>'seller_id')::text,
  p.id,
  'AVAILABLE',
  COALESCE((SELECT l2.listing_type FROM listing l2 WHERE l2.product_id = p.id), 'FIXED_PRICE'),
  p.metadata->>'condition',
  NOW(), NOW()
FROM product p
WHERE p.metadata->>'seller_id' IS NOT NULL
ON CONFLICT (product_id) DO UPDATE SET
  -- A seed rerun may repair old fixture attributes, but it must never undo
  -- a runtime sale, moderation decision, or seller reassignment.
  -- See documentation/AI_CONTEXT.md §4.3 and §8.5.
  seller_id = COALESCE(listing.seller_id, EXCLUDED.seller_id),
  listing_type = COALESCE(listing.listing_type, EXCLUDED.listing_type),
  item_condition = COALESCE(listing.item_condition, EXCLUDED.item_condition),
  updated_at = NOW();

-- Keep the four upstream Medusa demo products available for framework checks,
-- but hide them from the buyer marketplace until they have a real seller.
UPDATE product
   SET status = 'draft', updated_at = NOW()
 WHERE metadata->>'seller_id' IS NULL
   AND handle IN ('sweatpants', 'shorts', 'sweatshirt', 't-shirt');

-- Unique memorabilia items are inventory-managed with one available unit.
DO $$
DECLARE
  v_location_id TEXT;
  r RECORD;
  v_inventory_id TEXT;
  v_stocked_quantity NUMERIC;
BEGIN
  SELECT id INTO v_location_id
  FROM stock_location
  WHERE deleted_at IS NULL
  ORDER BY id
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RAISE NOTICE 'Skipping inventory seed: no stock location exists';
    RETURN;
  END IF;

  FOR r IN
    SELECT pv.id AS variant_id, pv.product_id, pv.sku, pv.title AS variant_title,
           p.title AS product_title, p.metadata->>'seller_handle' AS seller_handle,
           l.listing_status
    FROM product_variant pv
    JOIN product p ON p.id = pv.product_id
    JOIN listing l ON l.product_id = p.id AND l.deleted_at IS NULL
    WHERE p.metadata->>'seller_id' IS NOT NULL
      AND pv.deleted_at IS NULL
  LOOP
    v_inventory_id := 'inv_' || r.variant_id;
    v_stocked_quantity := CASE WHEN r.listing_status = 'SOLD' THEN 0 ELSE 1 END;

    INSERT INTO inventory_item
      (id, sku, title, description, requires_shipping, metadata, created_at, updated_at)
    VALUES
      (v_inventory_id, COALESCE(r.sku, 'PAWN-' || r.variant_id),
       r.product_title || ' — ' || r.variant_title,
       'Authenticity-controlled memorabilia inventory for ' || COALESCE(r.seller_handle, 'verified seller'),
       TRUE,
       jsonb_build_object('product_id', r.product_id, 'seller_handle', r.seller_handle, 'unique_item', TRUE),
       NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      metadata = EXCLUDED.metadata,
      updated_at = NOW();

    INSERT INTO inventory_level
      (id, inventory_item_id, location_id, stocked_quantity, reserved_quantity, incoming_quantity,
       raw_stocked_quantity, raw_reserved_quantity, raw_incoming_quantity, created_at, updated_at)
    VALUES
      ('invlevel_' || r.variant_id, v_inventory_id, v_location_id, v_stocked_quantity, 0, 0,
       jsonb_build_object('value', v_stocked_quantity::TEXT, 'precision', 20),
       jsonb_build_object('value', '0', 'precision', 20),
       jsonb_build_object('value', '0', 'precision', 20), NOW(), NOW())
    ON CONFLICT (inventory_item_id, location_id) WHERE deleted_at IS NULL DO UPDATE SET
      stocked_quantity = EXCLUDED.stocked_quantity,
      reserved_quantity = 0,
      raw_stocked_quantity = EXCLUDED.raw_stocked_quantity,
      raw_reserved_quantity = jsonb_build_object('value', '0', 'precision', 20),
      raw_incoming_quantity = jsonb_build_object('value', '0', 'precision', 20),
      updated_at = NOW();

    -- Medusa resolves saleable stock through this module link. Inventory
    -- items and levels alone do not make a managed variant purchasable.
    -- See documentation/AI_CONTEXT.md §4.2 and §8.5.
    INSERT INTO product_variant_inventory_item
      (id, variant_id, inventory_item_id, required_quantity, created_at, updated_at)
    VALUES
      ('invlink_' || r.variant_id, r.variant_id, v_inventory_id, 1, NOW(), NOW())
    ON CONFLICT (variant_id, inventory_item_id) DO UPDATE SET
      required_quantity = EXCLUDED.required_quantity,
      deleted_at = NULL,
      updated_at = NOW();

    UPDATE product_variant
       SET manage_inventory = TRUE,
           allow_backorder = FALSE,
           updated_at = NOW()
     WHERE id = r.variant_id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Verification summary
-- ---------------------------------------------------------------------------
SELECT 'sellers'   AS entity, COUNT(*) FROM seller
UNION ALL SELECT 'products',  COUNT(*) FROM product
UNION ALL SELECT 'variants',  COUNT(*) FROM product_variant
UNION ALL SELECT 'prices',    COUNT(*) FROM price
UNION ALL SELECT 'customers', COUNT(*) FROM customer
UNION ALL SELECT 'lineage',   COUNT(*) FROM product_lineage
UNION ALL SELECT 'listings',  COUNT(*) FROM listing
UNION ALL SELECT 'inventory_items', COUNT(*) FROM inventory_item
UNION ALL SELECT 'inventory_levels', COUNT(*) FROM inventory_level;
