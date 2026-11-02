-- Adds an EUR price to existing published products that only have USD or INR.
-- It leaves native Medusa schemas untouched and is safe to execute repeatedly.
-- See documentation/AI_CONTEXT.md §8.9.
WITH variant_price_sets AS (
  SELECT pv.id AS variant_id, pvp.price_set_id
  FROM product_variant pv
  JOIN product_variant_price_set pvp ON pvp.variant_id = pv.id
  JOIN product p ON p.id = pv.product_id
  WHERE pv.deleted_at IS NULL AND p.deleted_at IS NULL
), source_prices AS (
  SELECT vps.variant_id, vps.price_set_id,
         COALESCE(
           MAX(p.amount) FILTER (WHERE p.currency_code = 'usd' AND p.deleted_at IS NULL),
           ROUND(MAX(p.amount) FILTER (WHERE p.currency_code = 'inr' AND p.deleted_at IS NULL) / 90.0)
         ) AS eur_amount
  FROM variant_price_sets vps
  LEFT JOIN price p ON p.price_set_id = vps.price_set_id
  GROUP BY vps.variant_id, vps.price_set_id
)
INSERT INTO price (id, title, price_set_id, currency_code, raw_amount, rules_count, amount, created_at, updated_at)
SELECT 'price_eur_' || source.variant_id,
       NULL,
       source.price_set_id,
       'eur',
       jsonb_build_object('value', TRIM(TO_CHAR(source.eur_amount, 'FM999999990.00')), 'precision', 20),
       0,
       source.eur_amount,
       NOW(),
       NOW()
FROM source_prices source
WHERE source.eur_amount IS NOT NULL
  AND source.eur_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM price existing
    WHERE existing.price_set_id = source.price_set_id
      AND existing.currency_code = 'eur'
      AND existing.deleted_at IS NULL
  )
ON CONFLICT (id) DO NOTHING;
