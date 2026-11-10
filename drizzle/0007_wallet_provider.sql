-- ============================================================================
-- 0007_wallet_provider.sql
-- Wallet artifacts issued through an external pass provider (WalletWallet).
--
-- WHY THIS REMOVES OUR BIGGEST BLOCKER:
--   Until now no pass could really be issued to either wallet: an Apple Pass
--   Type ID certificate and a Google Wallet Issuer are both required, and the
--   platform's plan blocks the storage we would need for the images. A wallet
--   provider holds those credentials and returns a signed .pkpass plus a Google
--   save link in one call, so the product can ship that step today while the
--   provider stays swappable (ADR-005).
--
-- SECURITY: the artifacts are keyed to the pass and reachable only through the
-- SAME unguessable view token the customer already holds. Nothing here is
-- addressable by serial number alone.
-- ============================================================================

ALTER TABLE passes ADD COLUMN IF NOT EXISTS wallet_provider text;
-- The provider's own identifier for the pass; needed for later updates/revoke.
ALTER TABLE passes ADD COLUMN IF NOT EXISTS wallet_serial text;
-- The signed .pkpass, base64. Small (~30-80 KB) and served from our own origin so
-- iOS sees the correct content type instead of a JS blob download.
ALTER TABLE passes ADD COLUMN IF NOT EXISTS apple_pass_b64 text;
ALTER TABLE passes ADD COLUMN IF NOT EXISTS google_save_url text;
-- The provider's hosted install page: a single link that offers both wallets.
ALTER TABLE passes ADD COLUMN IF NOT EXISTS wallet_share_url text;
ALTER TABLE passes ADD COLUMN IF NOT EXISTS wallet_issued_at timestamptz;
-- Last provider error, so a failure is visible instead of silently absent.
ALTER TABLE passes ADD COLUMN IF NOT EXISTS wallet_error text;

CREATE INDEX IF NOT EXISTS passes_wallet_serial_idx ON passes (wallet_serial);

-- ---------------------------------------------------------------------------
-- Token-scoped read of the wallet state. DROP first: CREATE OR REPLACE cannot
-- change a function's OUT parameter names, and the wallet fields are new.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Persisting the artifacts. SECURITY DEFINER for the same reason as the reads:
-- the caller is an unauthenticated page holding only the token. It can write
-- ONLY the wallet columns of the single pass the token unlocks.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.app_store_wallet_artifacts(text, text, text, text, text, text);
CREATE FUNCTION public.app_store_wallet_artifacts(
  p_token text,
  p_provider text,
  p_wallet_serial text,
  p_apple_pass_b64 text,
  p_google_save_url text,
  p_share_url text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT p.id INTO v_id
  FROM passes p
  WHERE p.web_view_token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND length(p_token) >= 20;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'pass not found' USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE passes
     SET wallet_provider = p_provider,
         wallet_serial = p_wallet_serial,
         apple_pass_b64 = p_apple_pass_b64,
         google_save_url = p_google_save_url,
         wallet_share_url = p_share_url,
         wallet_issued_at = now(),
         wallet_error = NULL,
         updated_at = now()
   WHERE id = v_id;

  RETURN true;
END
$$;

DROP FUNCTION IF EXISTS public.app_record_wallet_error(text, text);
CREATE FUNCTION public.app_record_wallet_error(p_token text, p_error text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT p.id INTO v_id
  FROM passes p
  WHERE p.web_view_token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND length(p_token) >= 20;
  IF v_id IS NULL THEN RETURN false; END IF;
  UPDATE passes SET wallet_error = left(p_error, 500), updated_at = now() WHERE id = v_id;
  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.app_store_wallet_artifacts(text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_record_wallet_error(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_store_wallet_artifacts(text,text,text,text,text,text) TO taployal_app;
GRANT EXECUTE ON FUNCTION public.app_record_wallet_error(text,text) TO taployal_app;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_pass_wallet') THEN
    RAISE EXCEPTION 'app_pass_wallet was not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'passes' AND column_name = 'apple_pass_b64') THEN
    RAISE EXCEPTION 'wallet columns were not added to passes';
  END IF;
END
$$;
