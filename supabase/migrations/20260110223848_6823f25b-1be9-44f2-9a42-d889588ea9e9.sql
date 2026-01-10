-- Create recipe_user junction table
CREATE TABLE public.recipe_user (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipe(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

-- Enable Row Level Security
ALTER TABLE public.recipe_user ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own recipe associations"
ON public.recipe_user
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recipe associations"
ON public.recipe_user
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipe associations"
ON public.recipe_user
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_recipe_user_user_id ON public.recipe_user(user_id);
CREATE INDEX idx_recipe_user_recipe_id ON public.recipe_user(recipe_id);