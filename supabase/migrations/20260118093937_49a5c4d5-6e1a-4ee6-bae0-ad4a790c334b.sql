-- Add custom_text column to meal_plan table to allow custom meal entries
ALTER TABLE public.meal_plan ADD COLUMN custom_text TEXT;

-- Make recipe_id nullable to allow custom text entries without a recipe
ALTER TABLE public.meal_plan ALTER COLUMN recipe_id DROP NOT NULL;

-- Add a check constraint to ensure at least one of recipe_id or custom_text is provided
ALTER TABLE public.meal_plan ADD CONSTRAINT meal_plan_recipe_or_custom 
  CHECK (recipe_id IS NOT NULL OR custom_text IS NOT NULL);

-- Update the unique constraint to include custom entries
-- First drop the existing unique constraint if it exists
ALTER TABLE public.meal_plan DROP CONSTRAINT IF EXISTS meal_plan_user_id_plan_date_meal_slot_key;

-- Create a new unique constraint
ALTER TABLE public.meal_plan ADD CONSTRAINT meal_plan_user_id_plan_date_meal_slot_key 
  UNIQUE (user_id, plan_date, meal_slot);