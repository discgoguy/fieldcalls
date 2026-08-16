-- Move part pricing (cost / sales_price / nonsa_price) calculation into the
-- database so it can no longer drift from the app's forms, bulk import, or
-- direct edits, and so it cascades automatically when the global USD/CAD
-- exchange rate or a category's NonSA markup changes.
--
-- Mirrors the exact formulas found in src/pages/Parts.jsx's client-side
-- useEffect hooks (confirmed against live data before writing this):
--   - non-pack, USD supplier:  cost = cost_usd * exchange_rate
--   - pack, USD supplier:      cost = (cost_per_pack * exchange_rate) / pack_size
--   - pack, CAD supplier:      cost = cost_per_pack / pack_size
--   - non-assembly:            sales_price = round(cost * (1 + markup_percentage/100), 2)
--   - all (incl. assemblies):  nonsa_price = round(sales_price * (1 + categories.nonsa_markup_percentage/100), 2)
--
-- Assembly cost/sales_price are intentionally left alone here -- they're
-- rolled up from component parts + labor cost, which the app already
-- computes and writes; replicating that recursive rollup in SQL is a
-- separate piece of work if it's ever wanted. nonsa_price IS recalculated
-- for assemblies since it only depends on sales_price + category, both of
-- which are already correct on the row by the time this fires.

CREATE OR REPLACE FUNCTION calculate_part_pricing()
RETURNS TRIGGER AS $$
DECLARE
  v_is_usd       boolean;
  v_exchange_rate numeric;
  v_nonsa_markup numeric;
BEGIN
  -- Supplier currency (matched by name -- parts.supplier is free text, not an FK)
  SELECT is_usd INTO v_is_usd
  FROM suppliers
  WHERE name = NEW.supplier
  LIMIT 1;

  -- Current global exchange rate
  SELECT value::numeric INTO v_exchange_rate
  FROM settings
  WHERE key = 'usd_cad_exchange_rate'
  LIMIT 1;
  v_exchange_rate := COALESCE(v_exchange_rate, 1);

  IF NOT COALESCE(NEW.is_assembly, false) THEN

    -- cost
    IF COALESCE(NEW.is_pack, false) THEN
      IF NEW.cost_per_pack IS NOT NULL AND NEW.pack_size IS NOT NULL AND NEW.pack_size > 0 THEN
        NEW.cost := round(
          (CASE WHEN v_is_usd THEN (NEW.cost_per_pack * v_exchange_rate) ELSE NEW.cost_per_pack END
           / NEW.pack_size)::numeric, 4);
      END IF;
    ELSE
      IF v_is_usd AND NEW.cost_usd IS NOT NULL THEN
        NEW.cost := round((NEW.cost_usd * v_exchange_rate)::numeric, 4);
      END IF;
      -- CAD-supplier, non-pack parts keep their manually-entered `cost` as-is.
    END IF;

    -- sales_price
    IF NEW.cost IS NOT NULL AND NEW.markup_percentage IS NOT NULL THEN
      NEW.sales_price := round((NEW.cost * (1 + NEW.markup_percentage / 100))::numeric, 2);
    END IF;

  END IF;

  -- nonsa_price (non-assembly and assembly parts alike)
  IF NEW.sales_price IS NOT NULL THEN
    SELECT nonsa_markup_percentage INTO v_nonsa_markup
    FROM categories
    WHERE name = NEW.category
    LIMIT 1;

    NEW.nonsa_price := round((NEW.sales_price * (1 + COALESCE(v_nonsa_markup, 0) / 100))::numeric, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_part_pricing ON parts;
CREATE TRIGGER trg_calculate_part_pricing
  BEFORE INSERT OR UPDATE ON parts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_part_pricing();


-- Cascade: exchange rate change -> recalculate every USD-supplier, non-assembly part.
-- A no-op `SET cost = cost` is enough to re-fire the BEFORE trigger above for
-- every matching row without otherwise touching the record.
CREATE OR REPLACE FUNCTION cascade_exchange_rate_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.key = 'usd_cad_exchange_rate' AND (OLD.value IS DISTINCT FROM NEW.value) THEN
    UPDATE parts
    SET cost = cost
    WHERE is_assembly IS NOT TRUE
      AND supplier IN (SELECT name FROM suppliers WHERE is_usd = true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_exchange_rate ON settings;
CREATE TRIGGER trg_cascade_exchange_rate
  AFTER UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION cascade_exchange_rate_change();


-- Cascade: a category's NonSA markup changes -> recalculate nonsa_price for
-- every part in that category (assemblies included, since nonsa_price is
-- computed for them too).
CREATE OR REPLACE FUNCTION cascade_category_markup_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.nonsa_markup_percentage IS DISTINCT FROM NEW.nonsa_markup_percentage THEN
    UPDATE parts
    SET cost = cost
    WHERE category = NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_category_markup ON categories;
CREATE TRIGGER trg_cascade_category_markup
  AFTER UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION cascade_category_markup_change();


-- Cascade: a supplier is flipped between USD/CAD -> recalculate cost for
-- every part under that supplier.
CREATE OR REPLACE FUNCTION cascade_supplier_currency_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_usd IS DISTINCT FROM NEW.is_usd THEN
    UPDATE parts
    SET cost = cost
    WHERE supplier = NEW.name
      AND is_assembly IS NOT TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_supplier_currency ON suppliers;
CREATE TRIGGER trg_cascade_supplier_currency
  AFTER UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION cascade_supplier_currency_change();


-- One-time backfill: re-save every non-assembly part so the new trigger
-- recomputes cost/sales_price/nonsa_price from current settings/category
-- values. This is what fixes the 43 stale nonsa_price values, the 4 NULL
-- nonsa_price rows, and the broken A52-DM80320 row found in the audit.
-- Assemblies are included too, purely to refresh their nonsa_price.
UPDATE parts SET cost = cost;
