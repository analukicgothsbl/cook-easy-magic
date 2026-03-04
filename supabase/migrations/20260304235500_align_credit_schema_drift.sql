-- Align credit-related schema with runtime code/types.
-- Fixes drift for:
-- - public.credit_purchases
-- - public.guest_recipe_allowance
-- - public.credit_reason enum values used in functions

-- 1) Expand credit_reason enum to include values used by runtime code/types.
ALTER TYPE public.credit_reason ADD VALUE IF NOT EXISTS 'bonus_credit';
ALTER TYPE public.credit_reason ADD VALUE IF NOT EXISTS 'donate_bonus';
ALTER TYPE public.credit_reason ADD VALUE IF NOT EXISTS 'purchased_credit';
ALTER TYPE public.credit_reason ADD VALUE IF NOT EXISTS 'admin_bonus';
ALTER TYPE public.credit_reason ADD VALUE IF NOT EXISTS 'buy_credits_paypal';
ALTER TYPE public.credit_reason ADD VALUE IF NOT EXISTS 'generate_meal_planner';

-- 2) Create credit_purchases if missing.
CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  package_id TEXT NOT NULL,
  credits INTEGER NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  provider TEXT NOT NULL DEFAULT 'paypal',
  status TEXT NOT NULL DEFAULT 'pending',
  paypal_order_id TEXT NULL,
  paypal_capture_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id
  ON public.credit_purchases (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_status
  ON public.credit_purchases (status);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_paypal_order_id
  ON public.credit_purchases (paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_created_at
  ON public.credit_purchases (created_at DESC);

-- Ensure policy exists for users to view their own purchases.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'credit_purchases'
      AND policyname = 'Users can view their own credit purchases'
  ) THEN
    CREATE POLICY "Users can view their own credit purchases"
    ON public.credit_purchases
    FOR SELECT
    USING (user_id = (SELECT auth.uid()));
  END IF;
END
$$;

-- 3) Create guest_recipe_allowance if missing.
CREATE TABLE IF NOT EXISTS public.guest_recipe_allowance (
  guest_id TEXT PRIMARY KEY,
  used BOOLEAN NOT NULL DEFAULT false,
  first_used_at TIMESTAMPTZ NULL,
  last_payload JSONB NULL
);

ALTER TABLE public.guest_recipe_allowance ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_guest_recipe_allowance_used
  ON public.guest_recipe_allowance (used);
