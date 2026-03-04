-- Atomically save a recipe and charge credits for authenticated users.
-- This prevents "saved recipe but failed charge" inconsistencies.

CREATE OR REPLACE FUNCTION public.create_recipe_and_charge(
  p_user_id UUID,
  p_title TEXT,
  p_description_short TEXT,
  p_description_long TEXT,
  p_meal_category TEXT,
  p_cuisine TEXT,
  p_time_minutes INTEGER,
  p_difficulty TEXT,
  p_servings INTEGER,
  p_budget_level TEXT,
  p_kids_friendly BOOLEAN,
  p_ingredients_json JSONB,
  p_instructions TEXT,
  p_tips TEXT,
  p_nutrition_estimate JSONB,
  p_input_ingredients_json JSONB,
  p_input_tokens NUMERIC,
  p_output_tokens NUMERIC,
  p_total_tokens NUMERIC,
  p_cost_usd NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipe_id UUID;
  v_charge NUMERIC := GREATEST(0, COALESCE(p_cost_usd, 0));
  v_wallet_balance NUMERIC := 0;
  v_daily_bonus NUMERIC := 1;
  v_bonus_usage NUMERIC := 0;
  v_bonus_remaining NUMERIC := 0;
  v_use_from_bonus NUMERIC := 0;
  v_use_from_wallet NUMERIC := 0;
  v_new_bonus_usage NUMERIC := 0;
  v_new_bonus_remaining NUMERIC := 0;
  v_new_wallet_balance NUMERIC := 0;
  v_now TIMESTAMPTZ := NOW();
  v_ingredients JSONB[] := ARRAY[]::JSONB[];
  v_input_ingredients TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF p_title IS NULL OR BTRIM(p_title) = '' THEN
    RAISE EXCEPTION 'RECIPE_TITLE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- Lock wallet row for consistent balance checks under concurrency.
  SELECT balance, daily_remaining
    INTO v_wallet_balance, v_bonus_remaining
  FROM public.credit_wallet
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CREDIT_WALLET_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- Ensure bonus row exists, then lock it.
  INSERT INTO public.credit_bonus (user_id, daily_bonus, usage, updated_at)
  VALUES (p_user_id, 1, 0, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT daily_bonus, usage
    INTO v_daily_bonus, v_bonus_usage
  FROM public.credit_bonus
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_bonus_remaining := GREATEST(0, v_daily_bonus - v_bonus_usage);

  IF (v_wallet_balance + v_bonus_remaining) < v_charge THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS' USING ERRCODE = 'P0001';
  END IF;

  -- Convert JSON arrays to typed Postgres arrays used by the recipe table.
  IF JSONB_TYPEOF(COALESCE(p_ingredients_json, '[]'::JSONB)) = 'array' THEN
    SELECT COALESCE(ARRAY_AGG(value), ARRAY[]::JSONB[])
      INTO v_ingredients
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(p_ingredients_json, '[]'::JSONB));
  END IF;

  IF JSONB_TYPEOF(COALESCE(p_input_ingredients_json, '[]'::JSONB)) = 'array' THEN
    SELECT COALESCE(ARRAY_AGG(value), ARRAY[]::TEXT[])
      INTO v_input_ingredients
    FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(p_input_ingredients_json, '[]'::JSONB));
  END IF;

  INSERT INTO public.recipe (
    title,
    description_short,
    description_long,
    meal_category,
    cuisine,
    time_minutes,
    difficulty,
    servings,
    budget_level,
    kids_friendly,
    ingredients,
    instructions,
    tips,
    nutrition_estimate,
    input_ingredients,
    input_tokens,
    output_tokens,
    total_tokens,
    cost_usd
  )
  VALUES (
    BTRIM(p_title),
    NULLIF(BTRIM(COALESCE(p_description_short, '')), ''),
    NULLIF(BTRIM(COALESCE(p_description_long, '')), ''),
    CASE
      WHEN p_meal_category = ANY (ARRAY(SELECT UNNEST(ENUM_RANGE(NULL::public.meal_category))::TEXT))
        THEN p_meal_category::public.meal_category
      ELSE NULL
    END,
    CASE
      WHEN p_cuisine = ANY (ARRAY(SELECT UNNEST(ENUM_RANGE(NULL::public.cuisine_type))::TEXT))
        THEN p_cuisine::public.cuisine_type
      ELSE NULL
    END,
    p_time_minutes,
    CASE
      WHEN p_difficulty = ANY (ARRAY(SELECT UNNEST(ENUM_RANGE(NULL::public.difficulty_level))::TEXT))
        THEN p_difficulty::public.difficulty_level
      ELSE NULL
    END,
    p_servings,
    CASE
      WHEN p_budget_level = ANY (ARRAY(SELECT UNNEST(ENUM_RANGE(NULL::public.budget_level))::TEXT))
        THEN p_budget_level::public.budget_level
      ELSE NULL
    END,
    COALESCE(p_kids_friendly, FALSE),
    v_ingredients,
    p_instructions,
    NULLIF(BTRIM(COALESCE(p_tips, '')), ''),
    p_nutrition_estimate,
    v_input_ingredients,
    p_input_tokens,
    p_output_tokens,
    p_total_tokens,
    v_charge
  )
  RETURNING id INTO v_recipe_id;

  INSERT INTO public.recipe_user (user_id, recipe_id, created_at)
  VALUES (p_user_id, v_recipe_id, v_now)
  ON CONFLICT (user_id, recipe_id) DO UPDATE
    SET created_at = EXCLUDED.created_at;

  IF v_charge > 0 THEN
    v_use_from_bonus := LEAST(v_bonus_remaining, v_charge);
    v_use_from_wallet := v_charge - v_use_from_bonus;

    v_new_bonus_usage := v_bonus_usage + v_use_from_bonus;
    v_new_bonus_remaining := GREATEST(0, v_daily_bonus - v_new_bonus_usage);
    v_new_wallet_balance := v_wallet_balance - v_use_from_wallet;

    IF v_use_from_bonus > 0 THEN
      UPDATE public.credit_bonus
      SET usage = v_new_bonus_usage, updated_at = v_now
      WHERE user_id = p_user_id;

      INSERT INTO public.credit_usage (user_id, recipe_id, type, amount, reason, created_at)
      VALUES
        (p_user_id, NULL, 'income', v_use_from_bonus, 'bonus_credit', v_now),
        (p_user_id, v_recipe_id, 'cost', v_use_from_bonus, 'generate_recipe', v_now);
    END IF;

    IF v_use_from_wallet > 0 THEN
      INSERT INTO public.credit_usage (user_id, recipe_id, type, amount, reason, created_at)
      VALUES (p_user_id, v_recipe_id, 'cost', v_use_from_wallet, 'generate_recipe', v_now);
    END IF;

    UPDATE public.credit_wallet
    SET
      balance = v_new_wallet_balance,
      daily_remaining = v_new_bonus_remaining,
      updated_at = v_now
    WHERE user_id = p_user_id;
  END IF;

  RETURN v_recipe_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_recipe_and_charge(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  INTEGER,
  TEXT,
  INTEGER,
  TEXT,
  BOOLEAN,
  JSONB,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_recipe_and_charge(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  INTEGER,
  TEXT,
  INTEGER,
  TEXT,
  BOOLEAN,
  JSONB,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC
) TO service_role;
