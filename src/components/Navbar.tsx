import { motion } from 'framer-motion';
import { ChefHat, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const Navbar = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: 'Signed out',
      description: 'You have been signed out successfully.',
    });
    navigate('/');
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-md border-b border-border/50 shadow-[var(--shadow-soft)]"
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/">
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
        </Link>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.email}
              </span>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="bg-secondary text-secondary-foreground border-2 border-border hover:border-primary hover:bg-secondary font-medium transition-all duration-200"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
          <>
              <Link to="/auth" state={{ mode: "login" }}>
                <Button
                  variant="outline"
                  className="bg-secondary text-secondary-foreground border-2 border-border hover:border-primary hover:bg-secondary font-medium transition-all duration-200"
                >
                  Login
                </Button>
              </Link>
              <Link to="/auth" state={{ mode: "signup" }}>
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
};
