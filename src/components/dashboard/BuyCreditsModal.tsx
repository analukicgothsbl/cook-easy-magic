import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CreditCard, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CreditPackage {
  id: string;
  price: number;
  credits: number;
}

const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'pkg_10', price: 1, credits: 10 },
  { id: 'pkg_32', price: 3, credits: 32 },
  { id: 'pkg_55', price: 5, credits: 55 },
  { id: 'pkg_115', price: 10, credits: 115 },
];

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BuyCreditsModal({ isOpen, onClose }: BuyCreditsModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePurchase = async () => {
    if (!selectedPackage) {
      toast.error('Please select a credit package');
      return;
    }

    setIsLoading(true);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please sign in to buy credits');
        onClose();
        return;
      }

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('paypal-create-order', {
        body: { package_id: selectedPackage },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to start payment');
      }

      if (!data?.approvalUrl) {
        throw new Error('No approval URL received');
      }

      // Redirect to PayPal
      window.location.href = data.approvalUrl;

    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment could not be started. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Buy Credits
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Select a credit package to purchase via PayPal:
          </p>

          <div className="grid gap-3">
            {CREDIT_PACKAGES.map((pkg) => (
              <motion.button
                key={pkg.id}
                onClick={() => !isLoading && setSelectedPackage(pkg.id)}
                disabled={isLoading}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  selectedPackage === pkg.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 bg-card'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                whileHover={!isLoading ? { scale: 1.02 } : {}}
                whileTap={!isLoading ? { scale: 0.98 } : {}}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      ${pkg.price}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {pkg.credits} credits
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {(pkg.credits / pkg.price).toFixed(1)} credits/$
                    </span>
                    {selectedPackage === pkg.id && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          <button
            onClick={handlePurchase}
            disabled={!selectedPackage || isLoading}
            className="w-full btn-primary flex items-center justify-center gap-2 py-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to PayPal…
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Continue to PayPal
              </>
            )}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            You will be redirected to PayPal to complete your purchase.
            Credits will be added to your account after successful payment.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
