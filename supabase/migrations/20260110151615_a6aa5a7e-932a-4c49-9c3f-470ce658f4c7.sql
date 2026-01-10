-- Create recipe table
CREATE TABLE public.recipe (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description_short TEXT,
  description_long TEXT,
  cuisine cuisine_type,
  meal_category meal_category,
  time_minutes INTEGER,
  difficulty difficulty_level,
  kids_friendly BOOLEAN DEFAULT false,
  budget_level budget_level,
  servings INTEGER DEFAULT 2,
  input_ingredients TEXT[],
  ingredients JSONB[],
  instructions TEXT,
  tips TEXT,
  nutrition_estimate JSONB,
  input_tokens NUMERIC(10,2),
  output_tokens NUMERIC(10,2),
  total_tokens NUMERIC(10,2),
  cost_usd NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recipe_image table
CREATE TABLE public.recipe_image (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipe(id) ON DELETE CASCADE,
  image_url TEXT,
  usd_costs NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recipe_review table
CREATE TABLE public.recipe_review (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipe(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  review TEXT,
  rating NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recipe_favorites table with composite primary key
CREATE TABLE public.recipe_favorites (
  user_id UUID NOT NULL,
  recipe_id UUID NOT NULL REFERENCES public.recipe(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

-- Enable RLS on all tables
ALTER TABLE public.recipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_image ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_favorites ENABLE ROW LEVEL SECURITY;

-- Recipe policies (public read, admin write)
CREATE POLICY "Recipes are viewable by everyone"
ON public.recipe FOR SELECT
USING (true);

CREATE POLICY "Admins can manage recipes"
ON public.recipe FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Recipe image policies (public read, admin write)
CREATE POLICY "Recipe images are viewable by everyone"
ON public.recipe_image FOR SELECT
USING (true);

CREATE POLICY "Admins can manage recipe images"
ON public.recipe_image FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Recipe review policies
CREATE POLICY "Reviews are viewable by everyone"
ON public.recipe_review FOR SELECT
USING (true);

CREATE POLICY "Users can create their own reviews"
ON public.recipe_review FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.recipe_review FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
ON public.recipe_review FOR DELETE
USING (auth.uid() = user_id);

-- Recipe favorites policies
CREATE POLICY "Users can view their own favorites"
ON public.recipe_favorites FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites"
ON public.recipe_favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favorites"
ON public.recipe_favorites FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_recipe_cuisine ON public.recipe(cuisine);
CREATE INDEX idx_recipe_meal_category ON public.recipe(meal_category);
CREATE INDEX idx_recipe_time_minutes ON public.recipe(time_minutes);
CREATE INDEX idx_recipe_image_recipe_id ON public.recipe_image(recipe_id);
CREATE INDEX idx_recipe_review_recipe_id ON public.recipe_review(recipe_id);
CREATE INDEX idx_recipe_favorites_user_id ON public.recipe_favorites(user_id);

-- Add comment for time_available mapping reference
COMMENT ON TABLE public.recipe IS 'time_available enum maps to time_minutes: minimum=30, enough=60';