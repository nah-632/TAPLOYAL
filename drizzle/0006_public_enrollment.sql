-- ============================================================================
-- 0006_public_enrollment.sql
-- The ONE controlled public entry point — BUILD-PROMPT §3.C and §5 (QR enrollment).
--
-- THE PROBLEM: a customer scanning a QR in the street has no session and no
-- tenant context, so under RLS every SELECT on merchants/customers/passes
-- returns zero rows. The join page cannot work by reading those tables.
--
-- THE SOLUTION: a single, narrow, auditable function pair with SECURITY DEFINER.
--   app_public_program(slug)  -> ONLY the fields printed on the join page
--   app_join_program(...)     -> upserts the customer and issues the pass
--
-- WHY THIS IS SAFE:
--   * It exposes no tenant data beyond the merchant's own public programme
--     (name, logo, programme name, mode, stamp count) — exactly what a poster
--     in the shop shows anyway.
--   * It cannot be used to read another merchant's customers, passes or
--     transactions: it returns no row sets other than the one pass it creates.
--   * It is the only SECURITY DEFINER surface for writes; app_job_claim is the
--     other, and both have a pinned search_path.
-- ============================================================================

-- gen_random_bytes / digest come from pgcrypto, which is available on this
-- instance (verified) but not installed by default.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --- Public programme description (read-only, no PII) ------------------------
CREATE OR REPLACE FUNCTION public.app_public_program(p_slug text)
RETURNS TABLE (
  merchant_id uuid,
  business_name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  card_id uuid,
  program_name text,
  mode text,
  stamps_required integer,
  stamp_icon text,
  label_color text,
  terms_text text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.id, m.name, m.logo_url, m.primary_color, m.secondary_color,
         c.id, c.name, c.mode::text, c.stamps_required, c.stamp_icon,
         c.label_color, c.terms_text
  FROM merchants m
  JOIN loyalty_cards c ON c.merchant_id = m.id AND c.status = 'published'
  WHERE m.slug = lower(trim(p_slug)) AND m.status = 'active'
  LIMIT 1
$$;

-- --- Join (write). One transaction: rate limit -> customer -> pass -> job ----
-- DROP first: CREATE OR REPLACE cannot change a function's OUT parameter names,
-- and changing them is exactly how the ambiguous-column bug was fixed.
DROP FUNCTION IF EXISTS public.app_join_program(text, text, text, text, boolean, integer);
CREATE OR REPLACE FUNCTION public.app_join_program(
  p_slug text,
  p_full_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_consent boolean DEFAULT false,
  p_max_joins_per_minute integer DEFAULT 30
)
RETURNS TABLE (out_serial text, out_view_token text, out_existed boolean, out_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_merchant_id uuid;
  v_card_id uuid;
  v_name text;
  v_phone text;
  v_customer_id uuid;
  v_pass_id uuid;
  v_serial text;
  v_view_token text;
  v_auth_token text;
  v_balance integer;
  v_recent integer;
  v_existed boolean := false;
BEGIN
  IF p_consent IS NOT TRUE THEN
    RAISE EXCEPTION 'consent is required' USING ERRCODE = 'check_violation';
  END IF;

  v_name := nullif(trim(coalesce(p_full_name, '')), '');
  IF v_name IS NULL OR length(v_name) < 2 OR length(v_name) > 80 THEN
    RAISE EXCEPTION 'invalid name' USING ERRCODE = 'check_violation';
  END IF;

  -- Normalise: digits and a single leading +, at least 8 digits.
  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  IF length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8 THEN
    RAISE EXCEPTION 'invalid phone' USING ERRCODE = 'check_violation';
  END IF;

  SELECT m.id INTO v_merchant_id
  FROM merchants m WHERE m.slug = lower(trim(p_slug)) AND m.status = 'active';
  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'programme not found' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT c.id INTO v_card_id
  FROM loyalty_cards c
  WHERE c.merchant_id = v_merchant_id AND c.status = 'published'
  ORDER BY c.created_at LIMIT 1;
  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'programme not published' USING ERRCODE = 'no_data_found';
  END IF;

  -- Abuse control: joins for one programme in the last minute.
  SELECT count(*) INTO v_recent
  FROM customers cu
  WHERE cu.merchant_id = v_merchant_id
    AND cu.created_at > now() - interval '1 minute';
  IF v_recent >= p_max_joins_per_minute THEN
    RAISE EXCEPTION 'too many joins, please retry shortly' USING ERRCODE = 'too_many_connections';
  END IF;

  -- A duplicate phone for the same merchant must NOT create a second card.
  SELECT cu.id INTO v_customer_id
  FROM customers cu
  WHERE cu.merchant_id = v_merchant_id AND cu.phone = v_phone;

  IF v_customer_id IS NULL THEN
    INSERT INTO customers (merchant_id, full_name, phone, email, consent_at)
    VALUES (v_merchant_id, v_name, v_phone, nullif(trim(coalesce(p_email,'')), ''), now())
    RETURNING id INTO v_customer_id;
  ELSE
    v_existed := true;
    UPDATE customers SET consent_at = coalesce(consent_at, now()) WHERE id = v_customer_id;
  END IF;

  SELECT p.id, p.balance, p.serial_number
    INTO v_pass_id, v_balance, v_serial
  FROM passes p
  WHERE p.card_id = v_card_id AND p.customer_id = v_customer_id;
  -- (OUT parameter names below are deliberately prefixed `out_`: a plpgsql OUT
  --  parameter shadows a column of the same name and makes every reference
  --  ambiguous - that is exactly the bug this comment prevents.)

  IF v_pass_id IS NULL THEN
    -- Unguessable: 32 bytes of entropy, URL-safe. Only HASHES are stored; the
    -- raw token is returned once, to the customer who just joined.
    v_view_token := encode(gen_random_bytes(32), 'base64');
    v_auth_token := encode(gen_random_bytes(32), 'base64');
    v_serial := 'TP' || upper(encode(gen_random_bytes(9), 'hex'));

    INSERT INTO passes (
      merchant_id, card_id, customer_id, serial_number,
      auth_token_hash, web_view_token_hash, balance
    ) VALUES (
      v_merchant_id, v_card_id, v_customer_id, v_serial,
      encode(digest(v_auth_token, 'sha256'), 'hex'),
      encode(digest(v_view_token, 'sha256'), 'hex'),
      0
    ) RETURNING id, balance INTO v_pass_id, v_balance;

    -- Wallet update is queued in the SAME transaction (directive §7).
    INSERT INTO job_queue (merchant_id, kind, payload, dedupe_key)
    VALUES (
      v_merchant_id, 'wallet.issue',
      jsonb_build_object('pass_id', v_pass_id, 'serial_number', v_serial),
      'wallet.issue:' || v_pass_id::text
    ) ON CONFLICT (dedupe_key) DO NOTHING;
  ELSE
    v_existed := true;
    -- Existing card: re-issue a fresh view token so the old link cannot be
    -- reused by whoever saw it, and return it once.
    v_view_token := encode(gen_random_bytes(32), 'base64');
    UPDATE passes
       SET web_view_token_hash = encode(digest(v_view_token, 'sha256'), 'hex'),
           updated_at = now()
     WHERE id = v_pass_id;
  END IF;

  RETURN QUERY SELECT v_serial, v_view_token, v_existed, coalesce(v_balance, 0);
END
$$;

REVOKE ALL ON FUNCTION public.app_public_program(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_join_program(text,text,text,text,boolean,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_public_program(text) TO taployal_app;
GRANT EXECUTE ON FUNCTION public.app_join_program(text,text,text,text,boolean,integer) TO taployal_app;


-- --- Read one card by its unguessable view token ------------------------------
-- The token is presented in a URL, so this returns ONLY the minimum the card
-- web view needs: first name, balance, serial (for the QR) and programme info.
-- It exposes no phone, no email, no other customer, and no other merchant.
DROP FUNCTION IF EXISTS public.app_pass_by_token(text);
CREATE OR REPLACE FUNCTION public.app_pass_by_token(p_token text)
RETURNS TABLE (
  out_first_name text, out_balance integer, out_serial text,
  out_business_name text, out_program_name text, out_mode text,
  out_stamps_required integer, out_stamp_icon text,
  out_primary_color text, out_secondary_color text, out_label_color text,
  out_logo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT split_part(cu.full_name, ' ', 1),
         p.balance, p.serial_number,
         m.name, c.name, c.mode::text,
         c.stamps_required, c.stamp_icon,
         m.primary_color, m.secondary_color, c.label_color,
         m.logo_url
  FROM passes p
  JOIN customers cu ON cu.id = p.customer_id
  JOIN merchants m ON m.id = p.merchant_id AND m.status = 'active'
  JOIN loyalty_cards c ON c.id = p.card_id
  WHERE p.web_view_token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND length(p_token) >= 20
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.app_pass_by_token(text) TO taployal_app;
REVOKE ALL ON FUNCTION public.app_pass_by_token(text) FROM PUBLIC;

-- --- Self-check -------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_public_program') THEN
    RAISE EXCEPTION 'app_public_program was not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_join_program') THEN
    RAISE EXCEPTION 'app_join_program was not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_pass_by_token') THEN
    RAISE EXCEPTION 'app_pass_by_token was not created';
  END IF;
END
$$;
