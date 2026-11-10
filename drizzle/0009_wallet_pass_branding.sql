-- ============================================================================
-- 0009_wallet_pass_branding.sql
-- Adds the merchant's card colour to the wallet pass read.
--
-- WHY: a loyalty pass that ignores the merchant's brand is a product defect, and
-- WalletWallet exposes exactly one Free-plan-safe way to brand the pass face:
-- `colorPreset` (one of dark/blue/green/red/purple/orange). Custom hex `color`
-- and image URLs are Pro-only, so relying on them would make issuance start
-- failing with 400 the day the subscription changes. The mapping from the
-- merchant's hex to the nearest preset happens in code (src/palette/index.ts).
--
-- DROP first: CREATE OR REPLACE cannot change a function's OUT parameter names
-- or list (same constraint that made 0007 drop app_pass_wallet too).
-- ============================================================================

DROP FUNCTION IF EXISTS public.app_pass_wallet(text);
CREATE FUNCTION public.app_pass_wallet(p_token text)
RETURNS TABLE (
  out_pass_id uuid,
  out_serial text,
  out_first_name text,
  out_balance integer,
  out_business_name text,
  out_program_name text,
  out_mode text,
  out_stamps_required integer,
  out_primary_color text,
  out_has_apple boolean,
  out_google_url text,
  out_share_url text,
  out_provider text,
  out_error text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id,
         p.serial_number,
         split_part(cu.full_name, ' ', 1),
         p.balance,
         m.name,
         c.name,
         c.mode::text,
         c.stamps_required,
         coalesce(m.primary_color, '#14243a'),
         (p.apple_pass_b64 IS NOT NULL),
         p.google_save_url,
         p.wallet_share_url,
         p.wallet_provider,
         p.wallet_error
  FROM passes p
  JOIN customers cu ON cu.id = p.customer_id
  JOIN merchants m ON m.id = p.merchant_id AND m.status = 'active'
  JOIN loyalty_cards c ON c.id = p.card_id
  WHERE p.web_view_token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND length(p_token) >= 20
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.app_pass_wallet(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_pass_wallet(text) TO taployal_app;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'passes' AND column_name = 'wallet_share_url'
  ) THEN
    RAISE EXCEPTION '0007 wallet columns are missing';
  END IF;
END
$$;
