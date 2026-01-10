-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'cook_master');

-- Create enum for cuisine options
CREATE TYPE public.cuisine_type AS ENUM (
  'any_surprise_me',
  'home_style_traditional',
  'italian',
  'mediterranean',
  'mexican',
  'asian',
  'balkan',
  'healthy_light',
  'comfort_food'
);

-- Create enum for meal category
CREATE TYPE public.meal_category AS ENUM ('breakfast', 'lunch', 'dinner', 'dessert', 'snack');

-- Create enum for time available
CREATE TYPE public.time_available AS ENUM ('minimum', 'enough');

-- Create enum for difficulty
CREATE TYPE public.difficulty_level AS ENUM ('easy', 'medium', 'hard');

-- Create enum for budget level
CREATE TYPE public.budget_level AS ENUM ('cheap', 'normal', 'doesnt_matter');

-- Create user_roles table (following security best practices)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create user_extended table
CREATE TABLE public.user_extended (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT,
  profile_picture TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_extended
ALTER TABLE public.user_extended ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_extended
CREATE POLICY "Users can view their own profile"
ON public.user_extended
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.user_extended
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.user_extended
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.user_extended
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create user_options table
CREATE TABLE public.user_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cuisine cuisine_type DEFAULT 'any_surprise_me',
  meal_category meal_category DEFAULT 'lunch',
  time_available time_available DEFAULT 'enough',
  difficulty difficulty_level DEFAULT 'medium',
  kids_friendly BOOLEAN DEFAULT false,
  budget_level budget_level DEFAULT 'normal',
  servings INTEGER DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_options
ALTER TABLE public.user_options ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_options
CREATE POLICY "Users can view their own options"
ON public.user_options
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own options"
ON public.user_options
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own options"
ON public.user_options
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all options"
ON public.user_options
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_extended_updated_at
BEFORE UPDATE ON public.user_extended
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_options_updated_at
BEFORE UPDATE ON public.user_options
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();