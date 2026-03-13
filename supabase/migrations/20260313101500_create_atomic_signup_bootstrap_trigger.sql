-- Atomic signup bootstrap:
-- create all user profile/credit rows in the same transaction as auth.users insert.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  v_display_name := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data ->> 'display_name', '')), '');

  INSERT INTO public.user_extended (user_id, name, role)
  VALUES (NEW.id, v_display_name, 'cook_master')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_bonus (user_id, daily_bonus, usage)
  VALUES (NEW.id, 1, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_wallet (user_id, balance, daily_remaining)
  VALUES (NEW.id, 5, 1)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_options (user_id, kids_friendly, servings)
  VALUES (NEW.id, FALSE, 2)
  ON CONFLICT (user_id) DO NOTHING;

  -- Idempotent signup bonus ledger entry.
  INSERT INTO public.credit_usage (user_id, recipe_id, type, amount, reason)
  SELECT NEW.id, NULL, 'income', 5, 'signup_bonus'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.credit_usage AS cu
    WHERE cu.user_id = NEW.id
      AND cu.type = 'income'
      AND cu.reason = 'signup_bonus'
      AND cu.recipe_id IS NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();
