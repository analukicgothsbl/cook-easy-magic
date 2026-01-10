-- Drop remaining policies that depend on has_role function (some may have been dropped already)
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_extended;
DROP POLICY IF EXISTS "Admins can view all options" ON public.user_options;
DROP POLICY IF EXISTS "Admins can manage recipes" ON public.recipe;
DROP POLICY IF EXISTS "Admins can manage recipe images" ON public.recipe_image;
DROP POLICY IF EXISTS "Admins can manage all wallets" ON public.credit_wallet;
DROP POLICY IF EXISTS "Admins can manage all usage" ON public.credit_usage;
DROP POLICY IF EXISTS "Admins can manage all bonuses" ON public.credit_bonus;

-- Drop the user_roles table (this will drop the role column that depends on app_role)
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Drop the has_role function
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Drop the app_role enum type
DROP TYPE IF EXISTS public.app_role CASCADE;