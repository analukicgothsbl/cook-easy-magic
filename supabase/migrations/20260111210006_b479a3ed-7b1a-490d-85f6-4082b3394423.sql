-- Add policy for admins to insert credit_usage for any user
CREATE POLICY "Admins can insert credit usage for any user"
ON public.credit_usage
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_extended
    WHERE user_extended.user_id = auth.uid()
    AND user_extended.role = 'admin'
  )
);

-- Add policy for admins to view all credit_usage
CREATE POLICY "Admins can view all credit usage"
ON public.credit_usage
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_extended
    WHERE user_extended.user_id = auth.uid()
    AND user_extended.role = 'admin'
  )
);

-- Add policy for admins to insert credit_wallet for any user
CREATE POLICY "Admins can insert credit wallet for any user"
ON public.credit_wallet
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_extended
    WHERE user_extended.user_id = auth.uid()
    AND user_extended.role = 'admin'
  )
);

-- Add policy for admins to update credit_wallet for any user
CREATE POLICY "Admins can update credit wallet for any user"
ON public.credit_wallet
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_extended
    WHERE user_extended.user_id = auth.uid()
    AND user_extended.role = 'admin'
  )
);

-- Add policy for admins to view all credit_wallet
CREATE POLICY "Admins can view all credit wallets"
ON public.credit_wallet
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_extended
    WHERE user_extended.user_id = auth.uid()
    AND user_extended.role = 'admin'
  )
);