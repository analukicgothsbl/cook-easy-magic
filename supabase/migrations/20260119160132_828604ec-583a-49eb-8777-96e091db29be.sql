-- Optimize all RLS policies to use (SELECT auth.uid()) for better performance

-- ============================================
-- credit_bonus table
-- ============================================
DROP POLICY IF EXISTS "Users can insert their own bonus" ON public.credit_bonus;
CREATE POLICY "Users can insert their own bonus" 
ON public.credit_bonus 
FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own bonus" ON public.credit_bonus;
CREATE POLICY "Users can update their own bonus" 
ON public.credit_bonus 
FOR UPDATE 
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own bonus" ON public.credit_bonus;
CREATE POLICY "Users can view their own bonus" 
ON public.credit_bonus 
FOR SELECT 
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- credit_purchases table
-- ============================================
DROP POLICY IF EXISTS "Users can view their own credit purchases" ON public.credit_purchases;
CREATE POLICY "Users can view their own credit purchases" 
ON public.credit_purchases 
FOR SELECT 
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- credit_usage table
-- ============================================
DROP POLICY IF EXISTS "Admins can insert credit usage for any user" ON public.credit_usage;
CREATE POLICY "Admins can insert credit usage for any user" 
ON public.credit_usage 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM user_extended 
  WHERE user_extended.user_id = (SELECT auth.uid()) 
  AND user_extended.role = 'admin'::app_role
));

DROP POLICY IF EXISTS "Admins can view all credit usage" ON public.credit_usage;
CREATE POLICY "Admins can view all credit usage" 
ON public.credit_usage 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_extended 
  WHERE user_extended.user_id = (SELECT auth.uid()) 
  AND user_extended.role = 'admin'::app_role
));

DROP POLICY IF EXISTS "Users can insert their own usage" ON public.credit_usage;
CREATE POLICY "Users can insert their own usage" 
ON public.credit_usage 
FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own usage" ON public.credit_usage;
CREATE POLICY "Users can view their own usage" 
ON public.credit_usage 
FOR SELECT 
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- credit_wallet table
-- ============================================
DROP POLICY IF EXISTS "Admins can insert credit wallet for any user" ON public.credit_wallet;
CREATE POLICY "Admins can insert credit wallet for any user" 
ON public.credit_wallet 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM user_extended 
  WHERE user_extended.user_id = (SELECT auth.uid()) 
  AND user_extended.role = 'admin'::app_role
));

DROP POLICY IF EXISTS "Admins can update credit wallet for any user" ON public.credit_wallet;
CREATE POLICY "Admins can update credit wallet for any user" 
ON public.credit_wallet 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM user_extended 
  WHERE user_extended.user_id = (SELECT auth.uid()) 
  AND user_extended.role = 'admin'::app_role
));

DROP POLICY IF EXISTS "Admins can view all credit wallets" ON public.credit_wallet;
CREATE POLICY "Admins can view all credit wallets" 
ON public.credit_wallet 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_extended 
  WHERE user_extended.user_id = (SELECT auth.uid()) 
  AND user_extended.role = 'admin'::app_role
));

DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.credit_wallet;
CREATE POLICY "Users can insert their own wallet" 
ON public.credit_wallet 
FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own wallet" ON public.credit_wallet;
CREATE POLICY "Users can update their own wallet" 
ON public.credit_wallet 
FOR UPDATE 
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own wallet" ON public.credit_wallet;
CREATE POLICY "Users can view their own wallet" 
ON public.credit_wallet 
FOR SELECT 
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- meal_plan table
-- ============================================
DROP POLICY IF EXISTS "Users can create their own meal plans" ON public.meal_plan;
CREATE POLICY "Users can create their own meal plans" 
ON public.meal_plan 
FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own meal plans" ON public.meal_plan;
CREATE POLICY "Users can delete their own meal plans" 
ON public.meal_plan 
FOR DELETE 
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own meal plans" ON public.meal_plan;
CREATE POLICY "Users can update their own meal plans" 
ON public.meal_plan 
FOR UPDATE 
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own meal plans" ON public.meal_plan;
CREATE POLICY "Users can view their own meal plans" 
ON public.meal_plan 
FOR SELECT 
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- recipe_favorites table
-- ============================================
DROP POLICY IF EXISTS "Users can add their own favorites" ON public.recipe_favorites;
CREATE POLICY "Users can add their own favorites" 
ON public.recipe_favorites 
FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can remove their own favorites" ON public.recipe_favorites;
CREATE POLICY "Users can remove their own favorites" 
ON public.recipe_favorites 
FOR DELETE 
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own favorites" ON public.recipe_favorites;
CREATE POLICY "Users can view their own favorites" 
ON public.recipe_favorites 
FOR SELECT 
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- recipe_review table
-- ============================================
DROP POLICY IF EXISTS "Users can create their own reviews" ON public.recipe_review;
CREATE POLICY "Users can create their own reviews" 
ON public.recipe_review 
FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.recipe_review;
CREATE POLICY "Users can delete their own reviews" 
ON public.recipe_review 
FOR DELETE 
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.recipe_review;
CREATE POLICY "Users can update their own reviews" 
ON public.recipe_review 
FOR UPDATE 
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- recipe_user table
-- ============================================
DROP POLICY IF EXISTS "Users can create their own recipe associations" ON public.recipe_user;
CREATE POLICY "Users can create their own recipe associations" 
ON public.recipe_user 
FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own recipe associations" ON public.recipe_user;
CREATE POLICY "Users can delete their own recipe associations" 
ON public.recipe_user 
FOR DELETE 
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own recipe associations" ON public.recipe_user;
CREATE POLICY "Users can view their own recipe associations" 
ON public.recipe_user 
FOR SELECT 
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- user_extended table (INSERT and UPDATE only, SELECT already optimized)
-- ============================================
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_extended;
CREATE POLICY "Users can insert their own profile" 
ON public.user_extended 
FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_extended;
CREATE POLICY "Users can update their own profile" 
ON public.user_extended 
FOR UPDATE 
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- user_options table
-- ============================================
DROP POLICY IF EXISTS "Users can insert their own options" ON public.user_options;
CREATE POLICY "Users can insert their own options" 
ON public.user_options 
FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own options" ON public.user_options;
CREATE POLICY "Users can update their own options" 
ON public.user_options 
FOR UPDATE 
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own options" ON public.user_options;
CREATE POLICY "Users can view their own options" 
ON public.user_options 
FOR SELECT 
USING (user_id = (SELECT auth.uid()));