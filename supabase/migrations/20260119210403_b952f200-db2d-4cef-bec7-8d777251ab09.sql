-- Create a security definer function to check admin role (avoids recursive RLS issues)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_extended
    WHERE user_id = _user_id
      AND role = 'admin'::app_role
  )
$$;

-- Drop and recreate credit_usage policies using the security definer function
DROP POLICY IF EXISTS "Admins can insert credit usage for any user" ON public.credit_usage;
DROP POLICY IF EXISTS "Admins can view all credit usage" ON public.credit_usage;

CREATE POLICY "Admins can insert credit usage for any user"
ON public.credit_usage
FOR INSERT
WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can view all credit usage"
ON public.credit_usage
FOR SELECT
USING (public.is_admin((SELECT auth.uid())));

-- Drop and recreate credit_wallet policies using the security definer function
DROP POLICY IF EXISTS "Admins can insert credit wallet for any user" ON public.credit_wallet;
DROP POLICY IF EXISTS "Admins can update credit wallet for any user" ON public.credit_wallet;
DROP POLICY IF EXISTS "Admins can view all credit wallets" ON public.credit_wallet;

CREATE POLICY "Admins can insert credit wallet for any user"
ON public.credit_wallet
FOR INSERT
WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can update credit wallet for any user"
ON public.credit_wallet
FOR UPDATE
USING (public.is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can view all credit wallets"
ON public.credit_wallet
FOR SELECT
USING (public.is_admin((SELECT auth.uid())));