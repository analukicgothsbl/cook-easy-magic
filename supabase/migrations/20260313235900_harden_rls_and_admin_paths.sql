-- Phase 2 hardening:
-- 1) tighten recipe/recipe_image read from public -> authenticated shared access
-- 2) standardize admin RLS checks on is_admin()

-- ===========================
-- recipe + recipe_image reads
-- ===========================
DROP POLICY IF EXISTS "Recipes are viewable by everyone" ON public.recipe;
DROP POLICY IF EXISTS "Authenticated users can view shared recipes" ON public.recipe;
CREATE POLICY "Authenticated users can view shared recipes"
ON public.recipe
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Recipe images are viewable by everyone" ON public.recipe_image;
DROP POLICY IF EXISTS "Authenticated users can view shared recipe images" ON public.recipe_image;
CREATE POLICY "Authenticated users can view shared recipe images"
ON public.recipe_image
FOR SELECT
TO authenticated
USING (true);

-- =======================================
-- credit admin policies -> use is_admin()
-- =======================================
DROP POLICY IF EXISTS "Admins can insert credit usage for any user" ON public.credit_usage;
CREATE POLICY "Admins can insert credit usage for any user"
ON public.credit_usage
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can view all credit usage" ON public.credit_usage;
CREATE POLICY "Admins can view all credit usage"
ON public.credit_usage
FOR SELECT
TO authenticated
USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can insert credit wallet for any user" ON public.credit_wallet;
CREATE POLICY "Admins can insert credit wallet for any user"
ON public.credit_wallet
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can update credit wallet for any user" ON public.credit_wallet;
CREATE POLICY "Admins can update credit wallet for any user"
ON public.credit_wallet
FOR UPDATE
TO authenticated
USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can view all credit wallets" ON public.credit_wallet;
CREATE POLICY "Admins can view all credit wallets"
ON public.credit_wallet
FOR SELECT
TO authenticated
USING (public.is_admin((SELECT auth.uid())));
