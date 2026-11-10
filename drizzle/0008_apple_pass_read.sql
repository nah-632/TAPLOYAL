-- ============================================================================
-- 0008_apple_pass_read.sql
-- Token-scoped read of the signed .pkpass binary.
--
-- WHY A SECOND FUNCTION INSTEAD OF A COLUMN ON app_pass_wallet():
--   the status route is hit on every card page view, and the .pkpass is 30-80 KB
--   of base64. Returning it from the status read would push that payload over
--   the wire on every poll for no reason. The download route is the only caller
--   that needs the bytes, so it gets its own narrow function.
--
-- WHY THIS IS NEEDED AT ALL: the previous implementation selected from `passes`
--   directly by token hash. That cannot work — the runtime role is taployal_app
--   under FORCE RLS and an unauthenticated card visitor has no tenant context,
--   so the query matched zero rows and every .pkpass download would have 404'd
--   in production while looking correct in review. Reads stay inside the same
--   SECURITY DEFINER boundary as app_pass_by_token / app_pass_wallet: the token
--   is the only key, and it must be at least 20 chars and hash-match.
-- ============================================================================

DROP FUNCTION IF EXISTS public.app_apple_pass_by_token(text);

CREATE FUNCTION public.app_apple_pass_by_token(p_token text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.apple_pass_b64
  FROM passes p
  JOIN merchants m ON m.id = p.merchant_id AND m.status = 'active'
  WHERE p.web_view_token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND length(p_token) >= 20
    AND p.apple_pass_b64 IS NOT NULL
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.app_apple_pass_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_apple_pass_by_token(text) TO taployal_app;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_apple_pass_by_token') THEN
    RAISE EXCEPTION 'app_apple_pass_by_token was not created';
  END IF;
END
$$;
