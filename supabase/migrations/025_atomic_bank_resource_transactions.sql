BEGIN;

CREATE FUNCTION public.apply_bank_resource_transaction(
  p_bank_id uuid,
  p_resource_id uuid,
  p_quantity integer,
  p_transaction_type text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = '22023';
  END IF;
  IF p_transaction_type IS NULL OR p_transaction_type NOT IN ('deposit', 'withdrawal') THEN
    RAISE EXCEPTION 'Invalid transaction type' USING ERRCODE = '22023';
  END IF;

  IF p_transaction_type = 'deposit' THEN
    INSERT INTO public.bank_inventory AS inventory (bank_id, resource_id, quantity)
    VALUES (p_bank_id, p_resource_id, p_quantity)
    ON CONFLICT (bank_id, resource_id) DO UPDATE
      SET quantity = inventory.quantity + EXCLUDED.quantity,
          last_updated_at = now();
  ELSE
    UPDATE public.bank_inventory
    SET quantity = quantity - p_quantity,
        last_updated_at = now()
    WHERE bank_id = p_bank_id
      AND resource_id = p_resource_id
      AND quantity >= p_quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient resources' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.bank_transactions (
    bank_id,
    resource_id,
    transaction_type,
    quantity,
    user_id,
    notes
  )
  VALUES (
    p_bank_id,
    p_resource_id,
    p_transaction_type::public.bank_transaction_type,
    CASE WHEN p_transaction_type = 'deposit' THEN p_quantity ELSE -p_quantity END,
    auth.uid(),
    p_notes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_bank_resource_transaction(uuid, uuid, integer, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_bank_resource_transaction(uuid, uuid, integer, text, text)
  TO authenticated;

INSERT INTO public.migration_history(filename)
VALUES ('025_atomic_bank_resource_transactions.sql')
ON CONFLICT DO NOTHING;

COMMIT;
