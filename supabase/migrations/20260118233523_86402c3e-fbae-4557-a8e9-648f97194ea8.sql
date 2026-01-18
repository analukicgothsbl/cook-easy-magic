-- Drop the existing constraint first (it may have been recreated)
ALTER TABLE public.meal_plan DROP CONSTRAINT IF EXISTS meal_plan_meal_slot_check;

-- Update existing rows
UPDATE public.meal_plan SET meal_slot = 'dessert' WHERE meal_slot = 'snack_afternoon';

-- Add the new constraint that allows dessert instead of snack_afternoon
ALTER TABLE public.meal_plan ADD CONSTRAINT meal_plan_meal_slot_check CHECK (meal_slot IN ('breakfast', 'snack_morning', 'lunch', 'dessert', 'dinner'));