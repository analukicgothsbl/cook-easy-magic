-- Update RPCs to support reusing an existing recipe (global dedup) and storing
-- the embedding vector alongside newly inserted recipes.

-- ============================================================================
-- 1. create_recipe_and_charge  –  add p_existing_recipe_id + p_embedding
-- ============================================================================
-- Must drop old signature first because we're adding parameters.
DROP FUNCTION IF EXISTS public.create_recipe_and_charge(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, BOOLEAN,
  JSONB, TEXT, TEXT, JSONB, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC
);

CREATE OR REPLACE FUNCTION public.create_recipe_and_charge(
  p_user_id              UUID,
  p_title                TEXT,
  p_description_short    TEXT,
  p_description_long     TEXT,
  p_meal_category        TEXT,
  p_cuisine              TEXT,
  p_time_minutes         INTEGER,
  p_difficulty           TEXT,
  p_servings             INTEGER,
  p_budget_level         TEXT,
  p_kids_friendly        BOOLEAN,
  p_ingredients_json     JSONB,
  p_instructions         TEXT,
  p_tips                 TEXT,
  p_nutrition_estimate   JSONB,
  p_input_ingredients_json JSONB,
  p_input_tokens         NUMERIC,
  p_output_tokens        NUMERIC,
  p_total_tokens         NUMERIC,
  p_cost_usd             NUMERIC,
  -- New optional params for dedup
  p_existing_recipe_id   UUID    DEFAULT NULL,
  p_embedding            TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

  IF p_existing_recipe_id IS NULL AND (p_title IS NULL OR BTRIM(p_title) = '') THEN
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

  IF p_existing_recipe_id IS NOT NULL THEN
    -- Reuse path: skip INSERT, use the existing recipe row.
    v_recipe_id := p_existing_recipe_id;
  ELSE
    -- Normal path: insert a new recipe row.
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
      title, description_short, description_long, meal_category, cuisine,
      time_minutes, difficulty, servings, budget_level, kids_friendly,
      ingredients, instructions, tips, nutrition_estimate, input_ingredients,
      input_tokens, output_tokens, total_tokens, cost_usd, embedding
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
      v_charge,
      CASE WHEN p_embedding IS NOT NULL THEN p_embedding::vector(1536) ELSE NULL END
    )
    RETURNING id INTO v_recipe_id;
  END IF;

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
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, BOOLEAN,
  JSONB, TEXT, TEXT, JSONB, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  UUID, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_recipe_and_charge(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, BOOLEAN,
  JSONB, TEXT, TEXT, JSONB, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  UUID, TEXT
) TO service_role;


-- ============================================================================
-- 2. create_meal_plan_and_charge  –  support existing_recipe_id + embedding
--    per recipe in the JSON payload (signature unchanged)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_meal_plan_and_charge(
  p_user_id UUID,
  p_plan_date DATE,
  p_recipes_json JSONB,
  p_total_cost_usd NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_charge NUMERIC := GREATEST(0, COALESCE(p_total_cost_usd, 0));
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

  v_recipe JSONB;
  v_recipe_id UUID;
  v_existing_recipe_id UUID;
  v_meal_slot TEXT;
  v_meal_category TEXT;
  v_title TEXT;
  v_ingredients JSONB[] := ARRAY[]::JSONB[];
  v_instructions TEXT;
  v_created_recipes JSONB := '[]'::JSONB;
  v_first_recipe_id UUID;
  v_embedding_text TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF p_plan_date IS NULL THEN
    RAISE EXCEPTION 'PLAN_DATE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF JSONB_TYPEOF(COALESCE(p_recipes_json, '[]'::JSONB)) <> 'array'
     OR JSONB_ARRAY_LENGTH(COALESCE(p_recipes_json, '[]'::JSONB)) = 0 THEN
    RAISE EXCEPTION 'RECIPES_REQUIRED' USING ERRCODE = 'P0001';
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

  -- Replace existing meal plan for the selected date in the same transaction.
  DELETE FROM public.meal_plan
  WHERE user_id = p_user_id
    AND plan_date = p_plan_date;

  FOR v_recipe IN
    SELECT value
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(p_recipes_json, '[]'::JSONB))
  LOOP
    v_meal_slot := LOWER(COALESCE(v_recipe->>'meal_slot', ''));
    v_meal_category := CASE v_meal_slot
      WHEN 'breakfast' THEN 'breakfast'
      WHEN 'snack_morning' THEN 'snack'
      WHEN 'lunch' THEN 'lunch'
      WHEN 'dessert' THEN 'dessert'
      WHEN 'dinner' THEN 'dinner'
      ELSE NULL
    END;

    IF v_meal_category IS NULL THEN
      RAISE EXCEPTION 'INVALID_MEAL_SLOT' USING ERRCODE = 'P0001';
    END IF;

    v_title := NULLIF(BTRIM(COALESCE(v_recipe->>'title', '')), '');
    IF v_title IS NULL THEN
      RAISE EXCEPTION 'RECIPE_TITLE_REQUIRED' USING ERRCODE = 'P0001';
    END IF;

    -- Check if this recipe should reuse an existing row.
    v_existing_recipe_id := NULLIF(v_recipe->>'existing_recipe_id', '')::UUID;

    IF v_existing_recipe_id IS NOT NULL THEN
      v_recipe_id := v_existing_recipe_id;
    ELSE
      v_ingredients := ARRAY[]::JSONB[];
      IF JSONB_TYPEOF(COALESCE(v_recipe->'ingredients', '[]'::JSONB)) = 'array' THEN
        SELECT COALESCE(ARRAY_AGG(value), ARRAY[]::JSONB[])
          INTO v_ingredients
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(v_recipe->'ingredients', '[]'::JSONB));
      END IF;

      v_instructions := NULL;
      IF JSONB_TYPEOF(COALESCE(v_recipe->'instructions', '[]'::JSONB)) = 'array' THEN
        SELECT STRING_AGG(value, E'\n')
          INTO v_instructions
        FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(v_recipe->'instructions', '[]'::JSONB));
      END IF;

      v_embedding_text := NULLIF(v_recipe->>'embedding', '');

      INSERT INTO public.recipe (
        title, description_short, description_long, meal_category, cuisine,
        time_minutes, difficulty, servings, budget_level, kids_friendly,
        ingredients, instructions, tips, nutrition_estimate,
        input_tokens, output_tokens, total_tokens, cost_usd, embedding
      )
      VALUES (
        v_title,
        NULLIF(BTRIM(COALESCE(v_recipe->>'description_short', '')), ''),
        NULLIF(BTRIM(COALESCE(v_recipe->>'description_long', '')), ''),
        v_meal_category::public.meal_category,
        CASE
          WHEN COALESCE(v_recipe->>'cuisine', '') = ANY (ARRAY(SELECT UNNEST(ENUM_RANGE(NULL::public.cuisine_type))::TEXT))
            THEN (v_recipe->>'cuisine')::public.cuisine_type
          ELSE NULL
        END,
        NULLIF(v_recipe->>'time_minutes', '')::INTEGER,
        CASE
          WHEN COALESCE(v_recipe->>'difficulty', '') = ANY (ARRAY(SELECT UNNEST(ENUM_RANGE(NULL::public.difficulty_level))::TEXT))
            THEN (v_recipe->>'difficulty')::public.difficulty_level
          ELSE NULL
        END,
        NULLIF(v_recipe->>'servings', '')::INTEGER,
        CASE
          WHEN COALESCE(v_recipe->>'budget_level', '') = ANY (ARRAY(SELECT UNNEST(ENUM_RANGE(NULL::public.budget_level))::TEXT))
            THEN (v_recipe->>'budget_level')::public.budget_level
          ELSE NULL
        END,
        COALESCE((v_recipe->>'kids_friendly')::BOOLEAN, FALSE),
        v_ingredients,
        v_instructions,
        NULLIF(BTRIM(COALESCE(v_recipe->>'tips', '')), ''),
        v_recipe->'nutrition_estimate',
        NULLIF(v_recipe->>'input_tokens', '')::NUMERIC,
        NULLIF(v_recipe->>'output_tokens', '')::NUMERIC,
        NULLIF(v_recipe->>'total_tokens', '')::NUMERIC,
        NULLIF(v_recipe->>'cost_usd', '')::NUMERIC,
        CASE WHEN v_embedding_text IS NOT NULL THEN v_embedding_text::vector(1536) ELSE NULL END
      )
      RETURNING id INTO v_recipe_id;
    END IF;

    INSERT INTO public.recipe_user (user_id, recipe_id, created_at)
    VALUES (p_user_id, v_recipe_id, v_now)
    ON CONFLICT (user_id, recipe_id) DO UPDATE
      SET created_at = EXCLUDED.created_at;

    INSERT INTO public.recipe_favorites (user_id, recipe_id, created_at)
    VALUES (p_user_id, v_recipe_id, v_now)
    ON CONFLICT (user_id, recipe_id) DO UPDATE
      SET created_at = EXCLUDED.created_at;

    INSERT INTO public.meal_plan (user_id, plan_date, meal_slot, recipe_id)
    VALUES (p_user_id, p_plan_date, v_meal_slot, v_recipe_id);

    v_created_recipes := v_created_recipes || JSONB_BUILD_ARRAY(
      JSONB_BUILD_OBJECT(
        'meal_slot', v_meal_slot,
        'recipe_id', v_recipe_id,
        'title', v_title,
        'meal_category', v_meal_category,
        'time_minutes', NULLIF(v_recipe->>'time_minutes', '')::INTEGER,
        'servings', NULLIF(v_recipe->>'servings', '')::INTEGER
      )
    );
  END LOOP;

  IF JSONB_ARRAY_LENGTH(v_created_recipes) = 0 THEN
    RAISE EXCEPTION 'NO_RECIPES_CREATED' USING ERRCODE = 'P0001';
  END IF;

  IF v_charge > 0 THEN
    v_use_from_bonus := LEAST(v_bonus_remaining, v_charge);
    v_use_from_wallet := v_charge - v_use_from_bonus;

    v_new_bonus_usage := v_bonus_usage + v_use_from_bonus;
    v_new_bonus_remaining := GREATEST(0, v_daily_bonus - v_new_bonus_usage);
    v_new_wallet_balance := v_wallet_balance - v_use_from_wallet;

    v_first_recipe_id := NULLIF(v_created_recipes->0->>'recipe_id', '')::UUID;

    IF v_use_from_bonus > 0 THEN
      UPDATE public.credit_bonus
      SET usage = v_new_bonus_usage, updated_at = v_now
      WHERE user_id = p_user_id;

      INSERT INTO public.credit_usage (user_id, recipe_id, type, amount, reason, created_at)
      VALUES
        (p_user_id, NULL, 'income', v_use_from_bonus, 'bonus_credit', v_now),
        (p_user_id, v_first_recipe_id, 'cost', v_use_from_bonus, 'generate_recipe', v_now);
    END IF;

    IF v_use_from_wallet > 0 THEN
      INSERT INTO public.credit_usage (user_id, recipe_id, type, amount, reason, created_at)
      VALUES (p_user_id, v_first_recipe_id, 'cost', v_use_from_wallet, 'generate_recipe', v_now);
    END IF;

    UPDATE public.credit_wallet
    SET
      balance = v_new_wallet_balance,
      daily_remaining = v_new_bonus_remaining,
      updated_at = v_now
    WHERE user_id = p_user_id;
  END IF;

  RETURN v_created_recipes;
END;
$$;

-- Permissions unchanged (signature is the same for meal plan RPC).
REVOKE ALL ON FUNCTION public.create_meal_plan_and_charge(UUID, DATE, JSONB, NUMERIC)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_meal_plan_and_charge(UUID, DATE, JSONB, NUMERIC)
  TO service_role;
