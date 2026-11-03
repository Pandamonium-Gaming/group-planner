BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.guild_banks
    WHERE game_slug = 'wowforever' AND gold_balance NOT BETWEEN 0 AND 900719925474
  ) OR EXISTS (
    SELECT 1 FROM public.bank_transactions AS transaction
    JOIN public.guild_banks AS bank ON bank.id = transaction.bank_id
    WHERE bank.game_slug = 'wowforever' AND transaction.gold_amount NOT BETWEEN -900719925474 AND 900719925474
  ) THEN
    RAISE EXCEPTION 'Existing WoW money exceeds the supported copper range' USING ERRCODE = '22003';
  END IF;
END;
$$;

-- Existing WoW amounts were whole gold. Other games keep their original units.
UPDATE public.guild_banks
SET gold_balance = gold_balance * 10000
WHERE game_slug = 'wowforever';

UPDATE public.bank_transactions AS transaction
SET gold_amount = transaction.gold_amount * 10000
FROM public.guild_banks AS bank
WHERE transaction.bank_id = bank.id AND bank.game_slug = 'wowforever';

COMMENT ON COLUMN public.guild_banks.gold_balance IS 'Integer copper for WoW Forever; whole gold for Ashes.';
COMMENT ON COLUMN public.bank_transactions.gold_amount IS 'Signed integer copper for WoW Forever; whole gold for Ashes.';

CREATE FUNCTION public.apply_bank_gold_transaction(
  p_bank_id uuid,
  p_amount bigint,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance bigint;
  v_new_balance numeric;
  v_group_id uuid;
  v_role text;
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_amount IS NULL OR p_amount = 0 OR p_amount NOT BETWEEN -9007199254740991 AND 9007199254740991 THEN
    RAISE EXCEPTION 'Invalid currency amount' USING ERRCODE = '22023';
  END IF;

  SELECT group_id, gold_balance INTO v_group_id, v_balance
  FROM public.guild_banks WHERE id = p_bank_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank not found or inaccessible' USING ERRCODE = 'P0001';
  END IF;
  SELECT role INTO v_role
  FROM public.group_members
  WHERE group_id = v_group_id AND user_id = auth.uid()
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank not found or inaccessible' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(
    CASE WHEN p_amount > 0 THEN overrides.guild_bank_deposit ELSE overrides.guild_bank_withdraw END,
    v_role IN ('admin', 'officer', 'member')
  ) INTO v_allowed
  FROM public.group_permission_overrides AS overrides
  WHERE overrides.group_id = v_group_id AND overrides.role = v_role
  FOR SHARE;
  IF NOT FOUND THEN
    v_allowed := v_role IN ('admin', 'officer', 'member');
  END IF;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Insufficient permission for bank transaction' USING ERRCODE = '42501';
  END IF;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Invalid bank balance' USING ERRCODE = '22023';
  END IF;

  v_new_balance := v_balance::numeric + p_amount;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient money in bank' USING ERRCODE = 'P0001';
  END IF;
  IF v_new_balance > 9007199254740991 THEN
    RAISE EXCEPTION 'Bank balance exceeds supported range' USING ERRCODE = '22003';
  END IF;

  UPDATE public.guild_banks
  SET gold_balance = v_new_balance::bigint, updated_at = now()
  WHERE id = p_bank_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank not found or inaccessible' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.bank_transactions (bank_id, transaction_type, quantity, gold_amount, user_id, notes)
  VALUES (
    p_bank_id,
    CASE WHEN p_amount > 0 THEN 'deposit' ELSE 'withdrawal' END::public.bank_transaction_type,
    0, p_amount, auth.uid(), p_notes
  );
END;
$$;

REVOKE INSERT, UPDATE ON TABLE public.guild_banks FROM PUBLIC, anon, authenticated;
GRANT INSERT (group_id, game_slug) ON TABLE public.guild_banks TO authenticated;
GRANT UPDATE (name, description, deposit_min_role, withdraw_min_role, updated_at)
  ON TABLE public.guild_banks TO authenticated;

REVOKE ALL ON FUNCTION public.apply_bank_gold_transaction(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_bank_gold_transaction(uuid, bigint, text) TO authenticated;

INSERT INTO public.migration_history(filename) VALUES ('026_wow_bank_currency.sql');

COMMIT;
