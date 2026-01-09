import { motion } from 'framer-motion';
import { ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Navbar = () => {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-coral-100/50 shadow-soft"
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <motion.div 
          className="flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="w-10 h-10 bg-gradient-to-br from-coral-400 to-coral-500 rounded-xl flex items-center justify-center shadow-md">
            <ChefHat className="w-6 h-6 text-white" />
          </div>
          <span className="font-serif text-xl font-bold text-foreground">
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
            className="bg-coral-500 hover:bg-coral-600 text-white font-medium px-5 shadow-md hover:shadow-lg transition-all duration-200 border-2 border-coral-500 hover:border-coral-600"
          >
            Sign Up
          </Button>
        </div>
      </div>
    </motion.nav>
  );
};
