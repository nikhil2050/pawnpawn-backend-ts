-- PawnPawn marketplace prompt alignment
-- Idempotent data migration for Medusa-native categories, collections, options,
-- unique-item inventory and normalized Listing ownership.

BEGIN;

-- This migration aligns existing demo rows with the celebrity marketplace
-- contract while remaining safe to re-run in local development.
-- See documentation/AI_CONTEXT.md §4.3 and §5.6.

-- Native Medusa fashion taxonomy.
INSERT INTO product_category (id, name, handle, description, mpath, is_active, is_internal, rank, created_at, updated_at)
VALUES
  ('pcat_apparel', 'Apparel', 'apparel', 'Celebrity clothing and everyday garments.', 'pcat_apparel', true, false, 10, NOW(), NOW()),
  ('pcat_outerwear', 'Outerwear', 'outerwear', 'Jackets, coats and other outer layers.', 'pcat_outerwear', true, false, 11, NOW(), NOW()),
  ('pcat_footwear', 'Footwear', 'footwear', 'Celebrity shoes, boots and stage footwear.', 'pcat_footwear', true, false, 12, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  handle = EXCLUDED.handle,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Native Medusa campaign collection used by the seeded fall drop.
INSERT INTO product_collection (id, title, handle, created_at, updated_at)
VALUES ('pcol_fall_drop', 'Karan Johar Fall Drop', 'karan-johar-fall-drop', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, handle = EXCLUDED.handle, updated_at = NOW();

-- Native Medusa option definitions and values.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM product_option WHERE title = 'Size' AND deleted_at IS NULL) THEN
    INSERT INTO product_option (id, title, is_exclusive, created_at, updated_at)
    VALUES ('opt_size_marketplace', 'Size', false, NOW(), NOW());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM product_option WHERE title = 'Condition' AND deleted_at IS NULL) THEN
    INSERT INTO product_option (id, title, is_exclusive, created_at, updated_at)
    VALUES ('opt_condition_marketplace', 'Condition', false, NOW(), NOW());
  END IF;
END $$;

DO $$
DECLARE v_size_id TEXT; v_condition_id TEXT;
BEGIN
  SELECT id INTO v_size_id FROM product_option WHERE title = 'Size' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_condition_id FROM product_option WHERE title = 'Condition' AND deleted_at IS NULL LIMIT 1;
  INSERT INTO product_option_value (id, option_id, value, rank, created_at, updated_at)
  VALUES
    ('ov_market_size_one', v_size_id, 'One Size', 1, NOW(), NOW()),
    ('ov_market_size_s', v_size_id, 'S', 2, NOW(), NOW()),
    ('ov_market_size_m', v_size_id, 'M', 3, NOW(), NOW()),
    ('ov_market_size_l', v_size_id, 'L', 4, NOW(), NOW()),
    ('ov_market_size_xl', v_size_id, 'XL', 5, NOW(), NOW()),
    ('ov_market_size_eu42', v_size_id, 'EU 42', 6, NOW(), NOW()),
    ('ov_market_condition_new', v_condition_id, 'New', 1, NOW(), NOW()),
    ('ov_market_condition_like_new', v_condition_id, 'Like New', 2, NOW(), NOW()),
    ('ov_market_condition_gently_used', v_condition_id, 'Gently Used', 3, NOW(), NOW()),
    ('ov_market_condition_excellent', v_condition_id, 'Excellent', 4, NOW(), NOW())
  ON CONFLICT (option_id, value) WHERE (deleted_at IS NULL) DO UPDATE SET rank = EXCLUDED.rank, updated_at = NOW();
END $$;

-- Attach useful native categories to the existing celebrity catalog.
INSERT INTO product_category_product (product_id, product_category_id)
VALUES
  ('prod_beyonce_001', 'pcat_footwear'),
  ('prod_beyonce_002', 'pcat_apparel'),
  ('prod_kim_001', 'pcat_apparel'),
  ('prod_kim_002', 'pcat_apparel'),
  ('prod_leonardo_001', 'pcat_outerwear'),
  ('prod_rihanna_001', 'pcat_apparel'),
  ('prod_therock_002', 'pcat_footwear')
ON CONFLICT (product_id, product_category_id) DO NOTHING;

-- Demonstrate an influencer campaign using Medusa's native collection_id.
UPDATE product
   SET collection_id = 'pcol_fall_drop', updated_at = NOW()
 WHERE id IN ('prod_kim_001', 'prod_rihanna_001', 'prod_beyonce_002');

-- Link each unique marketplace variant to native Size and Condition options.
DO $$
DECLARE
  r RECORD;
  v_product_option_id TEXT;
  v_size_value_id TEXT;
  v_condition_value_id TEXT;
  v_size_option_id TEXT;
  v_condition_option_id TEXT;
BEGIN
  SELECT id INTO v_size_option_id FROM product_option WHERE title = 'Size' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_condition_option_id FROM product_option WHERE title = 'Condition' AND deleted_at IS NULL LIMIT 1;
  FOR r IN
    SELECT p.id AS product_id, pv.id AS variant_id,
           COALESCE(p.metadata->>'condition', 'Like New') AS condition,
           CASE
             WHEN p.id IN ('prod_therock_002') THEN 'EU 42'
             WHEN p.id IN ('prod_beyonce_002') THEN 'S'
             WHEN p.id IN ('prod_leonardo_001') THEN 'M'
             WHEN p.id IN ('prod_rihanna_001') THEN 'S'
             WHEN p.id IN ('prod_kim_001') THEN 'L'
             ELSE 'One Size'
           END AS size_value
      FROM product p
      JOIN product_variant pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
     WHERE p.metadata->>'seller_handle' IS NOT NULL
  LOOP
    SELECT id INTO v_size_value_id FROM product_option_value
     WHERE option_id = v_size_option_id AND value = r.size_value AND deleted_at IS NULL LIMIT 1;
    SELECT id INTO v_condition_value_id FROM product_option_value
     WHERE option_id = v_condition_option_id AND value = r.condition AND deleted_at IS NULL LIMIT 1;

    v_product_option_id := 'ppo_' || r.product_id || '_size';
    INSERT INTO product_product_option (id, product_id, product_option_id, created_at, updated_at)
    VALUES (v_product_option_id, r.product_id, v_size_option_id, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO product_product_option_value (id, product_product_option_id, product_option_value_id, created_at, updated_at)
    VALUES ('ppov_' || r.product_id || '_size', v_product_option_id, v_size_value_id, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO product_variant_option (variant_id, option_value_id)
    VALUES (r.variant_id, v_size_value_id)
    ON CONFLICT (variant_id, option_value_id) DO NOTHING;

    v_product_option_id := 'ppo_' || r.product_id || '_condition';
    INSERT INTO product_product_option (id, product_id, product_option_id, created_at, updated_at)
    VALUES (v_product_option_id, r.product_id, v_condition_option_id, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO product_product_option_value (id, product_product_option_id, product_option_value_id, created_at, updated_at)
    VALUES ('ppov_' || r.product_id || '_condition', v_product_option_id, v_condition_value_id, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO product_variant_option (variant_id, option_value_id)
    VALUES (r.variant_id, v_condition_value_id)
    ON CONFLICT (variant_id, option_value_id) DO NOTHING;
  END LOOP;
END $$;

-- Canonical celebrity SKU format and zero-friction unique inventory.
DO $$
DECLARE
  r RECORD;
  v_prefix TEXT;
  v_sku TEXT;
  v_old_sku TEXT;
BEGIN
  FOR r IN
    SELECT p.id AS product_id, pv.id AS variant_id, s.handle
      FROM product p
      JOIN listing l ON l.product_id = p.id
      JOIN seller s ON s.id = l.seller_id
      JOIN product_variant pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
     WHERE p.metadata->>'seller_handle' IS NOT NULL
  LOOP
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM product_category_product x WHERE x.product_id = r.product_id AND x.product_category_id = 'pcat_outerwear') THEN 'OUT'
      WHEN EXISTS (SELECT 1 FROM product_category_product x WHERE x.product_id = r.product_id AND x.product_category_id = 'pcat_footwear') THEN 'FTW'
      ELSE 'APP'
    END INTO v_prefix;
    v_sku := 'CELEB-' || UPPER(regexp_replace(r.handle, '[^A-Za-z0-9]+', '-', 'g')) || '-' || v_prefix || '-' || UPPER(substr(md5(r.product_id), 1, 8));

    SELECT sku INTO v_old_sku FROM product_variant WHERE id = r.variant_id;

    UPDATE product_variant
       SET sku = v_sku, manage_inventory = true, allow_backorder = false, updated_at = NOW()
     WHERE id = r.variant_id;
    UPDATE inventory_item SET sku = v_sku, updated_at = NOW()
     WHERE sku = v_old_sku;
    UPDATE inventory_level
       SET stocked_quantity = CASE WHEN l.listing_status = 'SOLD' THEN 0 ELSE 1 END,
           reserved_quantity = 0, updated_at = NOW()
      FROM listing l
     WHERE inventory_level.inventory_item_id IN (SELECT id FROM inventory_item WHERE sku = v_sku)
       AND l.product_id = r.product_id;
  END LOOP;
END $$;

-- Listing is the only source of listing type; native product schemas remain untouched.
ALTER TABLE listing ADD COLUMN IF NOT EXISTS admin_feedback TEXT;
UPDATE listing SET admin_feedback = rejection_feedback WHERE admin_feedback IS NULL AND rejection_feedback IS NOT NULL;

COMMIT;

SELECT 'aligned_sellers' AS entity, COUNT(*) FROM seller
UNION ALL SELECT 'aligned_listings', COUNT(*) FROM listing
UNION ALL SELECT 'listed_products', COUNT(*) FROM listing WHERE listing_status = 'LISTED'
UNION ALL SELECT 'native_marketplace_categories', COUNT(*) FROM product_category WHERE id IN ('pcat_apparel', 'pcat_outerwear', 'pcat_footwear')
UNION ALL SELECT 'native_marketplace_options', COUNT(*) FROM product_option WHERE title IN ('Size', 'Condition') AND deleted_at IS NULL
UNION ALL SELECT 'inventory_managed_variants', COUNT(*) FROM product_variant WHERE manage_inventory = true;
