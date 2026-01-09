import { motion } from 'framer-motion';
import { ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Navbar = () => {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-coral-100/50 shadow-[0_4px_20px_-4px_rgba(251,146,60,0.25)]"
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <motion.div 
          className="flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl text-foreground">
            Cook Master
          </span>
        </motion.div>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="text-foreground hover:text-coral-600 hover:bg-coral-50 font-medium transition-all duration-200"
          >
            Login
          </Button>
          <Button
            className="bg-gradient-to-r from-coral-400 to-coral-500 hover:from-coral-500 hover:to-coral-600 text-white font-semibold px-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Sign Up
          </Button>
        </div>
      </div>
    </motion.nav>
  );
};
