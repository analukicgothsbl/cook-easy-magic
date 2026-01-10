-- Add role column to user_extended table
ALTER TABLE public.user_extended 
ADD COLUMN role app_role;