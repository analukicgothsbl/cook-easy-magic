-- Create enum for credit transaction type
CREATE TYPE credit_type AS ENUM ('income', 'cost');

-- Create enum for credit reason
CREATE TYPE credit_reason AS ENUM ('signup_bonus', 'friend_bonus', 'generate_recipe', 'generate_recipe_image');

-- Create credit_wallet table
CREATE TABLE public.credit_wallet (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  daily_remaining NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create credit_usage table
CREATE TABLE public.credit_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recipe_id UUID REFERENCES public.recipe(id) ON DELETE SET NULL,
  type credit_type NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  reason credit_reason NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create credit_bonus table
CREATE TABLE public.credit_bonus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  daily_bonus INTEGER NOT NULL DEFAULT 1,
  usage NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.credit_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_bonus ENABLE ROW LEVEL SECURITY;

-- Credit wallet policies
CREATE POLICY "Users can view their own wallet"
ON public.credit_wallet FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet"
ON public.credit_wallet FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"
ON public.credit_wallet FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all wallets"
ON public.credit_wallet FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Credit usage policies
CREATE POLICY "Users can view their own usage"
ON public.credit_usage FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
ON public.credit_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all usage"
ON public.credit_usage FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Credit bonus policies
CREATE POLICY "Users can view their own bonus"
ON public.credit_bonus FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bonus"
ON public.credit_bonus FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bonus"
ON public.credit_bonus FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all bonuses"
ON public.credit_bonus FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX idx_credit_wallet_user_id ON public.credit_wallet(user_id);
CREATE INDEX idx_credit_usage_user_id ON public.credit_usage(user_id);
CREATE INDEX idx_credit_usage_recipe_id ON public.credit_usage(recipe_id);
CREATE INDEX idx_credit_bonus_user_id ON public.credit_bonus(user_id);

-- Add trigger for updated_at on credit_wallet
CREATE TRIGGER update_credit_wallet_updated_at
BEFORE UPDATE ON public.credit_wallet
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on credit_bonus
CREATE TRIGGER update_credit_bonus_updated_at
BEFORE UPDATE ON public.credit_bonus
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();