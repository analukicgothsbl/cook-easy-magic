-- Admin can delete recipes
CREATE POLICY "Admins can delete recipes"
ON public.recipe FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Admin can delete recipe_favorites for any user (for cascade cleanup)
CREATE POLICY "Admins can delete any favorites"
ON public.recipe_favorites FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Admin can delete recipe_user associations
CREATE POLICY "Admins can delete any recipe_user"
ON public.recipe_user FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Admin can delete recipe_image
CREATE POLICY "Admins can delete any recipe_image"
ON public.recipe_image FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Admin can delete recipe_review
CREATE POLICY "Admins can delete any recipe_review"
ON public.recipe_review FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Admin can update credit_usage (to null out recipe_id)
CREATE POLICY "Admins can update credit usage"
ON public.credit_usage FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()));

-- Admin can update meal_plan (to null out recipe_id)
CREATE POLICY "Admins can update any meal_plan"
ON public.meal_plan FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()));