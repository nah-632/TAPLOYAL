-- ============================================================================
-- 0004_transaction_engine.sql
-- The atomic core: points/stamps transactions, idempotency, and a
-- transactional job queue for wallet updates.
--
-- Directive §7: "لا تجعل تحديث البطاقة أو إرسال الإشعار عملية مرتبطة مباشرة
--                باستجابة الموظف. يجب أن تتم معاملة النقاط أولًا بنجاح داخل
--                قاعدة البيانات، ثم تُرسل مهمة تحديث البطاقة."
-- Spec §6: "Transactions is append-only. The balance in Passes is updated inside
--           the same database transaction that inserts the Transaction row."
--
-- WHY THE CRITICAL SECTION LIVES IN THE DATABASE:
--   .pkpass re-signing and APNs pushes must never be able to corrupt the
--   ledger, and a double-tap must be impossible to double-record. Expressing
--   the unit of work as a single PL/pgSQL function makes atomicity structural
--   rather than a property the caller has to remember.
--   The function is SECURITY INVOKER, so tenant RLS still applies to it.
-- ============================================================================

-- --- Idempotency keys are scoped per tenant, not globally --------------------
DROP INDEX IF EXISTS transactions_idempotency_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_merchant_idempotency_key
  ON transactions (merchant_id, idempotency_key);

-- --- Transactional job queue -------------------------------------------------
CREATE TABLE IF NOT EXISTS job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_queue_status_check CHECK (status IN ('pending','running','succeeded','dead'))
);

-- A dedupe key makes enqueueing idempotent too: re-running the same unit of
-- work cannot pile up duplicate wallet updates.
CREATE UNIQUE INDEX IF NOT EXISTS job_queue_dedupe_key ON job_queue (dedupe_key);
CREATE INDEX IF NOT EXISTS job_queue_claim_idx ON job_queue (status, run_after) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS job_queue_merchant_idx ON job_queue (merchant_id);

-- Tenant isolation, same shape as every other table.
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON job_queue;
CREATE POLICY tenant_isolation ON job_queue
  FOR ALL TO taployal_app
  USING (public.app_is_super_admin() OR merchant_id = public.app_merchant_id())
  WITH CHECK (public.app_is_super_admin() OR merchant_id = public.app_merchant_id());

REVOKE ALL ON job_queue FROM taployal_app;
GRANT SELECT, INSERT, UPDATE ON job_queue TO taployal_app;  -- no DELETE: never lose work

-- ============================================================================
-- app_record_transaction — the single sanctioned way the balance can change.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.app_record_transaction(
  p_merchant_id uuid,
  p_pass_id uuid,
  p_type text,
  p_amount integer,
  p_idempotency_key text,
  p_branch_id uuid DEFAULT NULL,
  p_staff_user_id uuid DEFAULT NULL,
  p_reward_id uuid DEFAULT NULL,
  p_reverted_transaction_id uuid DEFAULT NULL
) RETURNS TABLE (transaction_id uuid, new_balance integer, deduplicated boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_id uuid;
  v_existing_balance integer;
  v_balance integer;
  v_new_balance integer;
  v_tx_id uuid;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id is required' USING ERRCODE = 'null_value_not_allowed';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) = 0 THEN
    RAISE EXCEPTION 'idempotency_key is required' USING ERRCODE = 'null_value_not_allowed';
  END IF;
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'amount must be non-zero' USING ERRCODE = 'check_violation';
  END IF;

  -- 1. IDEMPOTENCY: a repeated key returns the original result, never a 2nd row.
  --    RLS scopes this lookup to the caller's tenant automatically.
  SELECT t.id INTO v_existing_id
  FROM transactions t
  WHERE t.merchant_id = p_merchant_id AND t.idempotency_key = p_idempotency_key;

  IF v_existing_id IS NOT NULL THEN
    SELECT p.balance INTO v_existing_balance
    FROM passes p JOIN transactions t ON t.pass_id = p.id
    WHERE t.id = v_existing_id;
    RETURN QUERY SELECT v_existing_id, v_existing_balance, true;
    RETURN;
  END IF;

  -- 2. LOCK the pass row. This serialises concurrent taps on the same card, so
  --    two racing requests cannot both read the old balance.
  SELECT p.balance INTO v_balance
  FROM passes p
  WHERE p.id = p_pass_id AND p.merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Covers both "does not exist" and "belongs to another tenant".
    -- The message stays generic on purpose: never disclose which.
    RAISE EXCEPTION 'pass not found in tenant scope' USING ERRCODE = 'no_data_found';
  END IF;

  v_new_balance := v_balance + p_amount;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'insufficient balance: % + % = %', v_balance, p_amount, v_new_balance
      USING ERRCODE = 'check_violation';
  END IF;

  -- 3. Append-only ledger row.
  INSERT INTO transactions (
    merchant_id, pass_id, branch_id, staff_user_id, type, amount,
    reward_id, reverted_transaction_id, idempotency_key
  ) VALUES (
    p_merchant_id, p_pass_id, p_branch_id, p_staff_user_id, p_type::transaction_type,
    p_amount, p_reward_id, p_reverted_transaction_id, p_idempotency_key
  ) RETURNING id INTO v_tx_id;

  -- 4. Balance moves in the SAME transaction as the ledger row.
  UPDATE passes
     SET balance = v_new_balance,
         last_updated_tag = gen_random_uuid()::text,
         updated_at = now()
   WHERE id = p_pass_id;

  -- 5. Queue the wallet update in the SAME transaction (§7). If the ledger
  --    rolls back, the job cannot exist — the queue can never reference a
  --    balance change that did not happen.
  INSERT INTO job_queue (merchant_id, kind, payload, dedupe_key)
  VALUES (
    p_merchant_id,
    'wallet.update',
    jsonb_build_object('pass_id', p_pass_id, 'balance', v_new_balance, 'transaction_id', v_tx_id),
    'wallet.update:' || p_pass_id::text || ':' || v_tx_id::text
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN QUERY SELECT v_tx_id, v_new_balance, false;
END
$$;

REVOKE ALL ON FUNCTION public.app_record_transaction(uuid,uuid,text,integer,text,uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_record_transaction(uuid,uuid,text,integer,text,uuid,uuid,uuid,uuid) TO taployal_app;

-- ============================================================================
-- Job queue worker primitives.
-- app_job_claim is the ONE deliberate SECURITY DEFINER exception: a background
-- worker legitimately operates across tenants, and giving it tenant context per
-- row would be meaningless. It can do exactly one narrow thing — claim rows.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.app_job_claim(p_batch integer, p_worker text)
RETURNS SETOF job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM job_queue
     WHERE status = 'pending' AND run_after <= now()
     ORDER BY run_after
     FOR UPDATE SKIP LOCKED
     LIMIT p_batch
  )
  UPDATE job_queue j
     SET status = 'running', locked_at = now(), locked_by = p_worker,
         attempts = j.attempts + 1, updated_at = now()
   FROM claimed c
  WHERE j.id = c.id
  RETURNING j.*;
END
$$;

CREATE OR REPLACE FUNCTION public.app_job_succeed(p_job_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE job_queue SET status = 'succeeded', last_error = NULL, updated_at = now() WHERE id = p_job_id;
$$;

-- Exponential backoff; after max_attempts the job goes to the dead-letter state
-- instead of retrying forever.
CREATE OR REPLACE FUNCTION public.app_job_fail(p_job_id uuid, p_error text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_attempts integer; v_max integer; v_status text;
BEGIN
  UPDATE job_queue
     SET attempts = attempts, last_error = left(p_error, 1000), updated_at = now()
   WHERE id = p_job_id
   RETURNING attempts, max_attempts INTO v_attempts, v_max;

  IF v_attempts >= v_max THEN
    UPDATE job_queue SET status = 'dead', locked_at = NULL WHERE id = p_job_id;
    v_status := 'dead';
  ELSE
    UPDATE job_queue
       SET status = 'pending',
           locked_at = NULL,
           locked_by = NULL,
           -- 2^attempts seconds, capped at 1 hour
           run_after = now() + make_interval(secs => least(power(2, v_attempts)::int, 3600))
     WHERE id = p_job_id;
    v_status := 'pending';
  END IF;
  RETURN v_status;
END
$$;

REVOKE ALL ON FUNCTION public.app_job_claim(integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_job_succeed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_job_fail(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_job_claim(integer,text) TO taployal_app;
GRANT EXECUTE ON FUNCTION public.app_job_succeed(uuid) TO taployal_app;
GRANT EXECUTE ON FUNCTION public.app_job_fail(uuid,text) TO taployal_app;

-- --- Self-check: the engine must not exist without its safety rails --------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'transactions_merchant_idempotency_key') THEN
    RAISE EXCEPTION 'per-tenant idempotency index is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'job_queue' AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'job_queue must have RLS + FORCE enabled';
  END IF;
END
$$;
