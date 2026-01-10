-- Recreate the app_role enum
CREATE TYPE public.app_role AS ENUM ('cook_master', 'admin');

-- Add role column to user_extended table
ALTER TABLE public.user_extended 
ADD COLUMN role app_role DEFAULT 'cook_master';