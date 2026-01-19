-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_extended;

-- Recreate with optimized auth.uid() call using subquery
CREATE POLICY "Users can view their own profile" 
ON public.user_extended 
FOR SELECT 
USING (user_id = (SELECT auth.uid()));