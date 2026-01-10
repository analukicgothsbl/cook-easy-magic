import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChefHat, Heart, BookOpen, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardView } from '@/pages/Dashboard';

interface OverviewViewProps {
  onNavigate: (view: DashboardView) => void;
}

interface Stats {
  totalRecipes: number;
  favoriteRecipes: number;
  creditsRemaining: number;
}

export function OverviewView({ onNavigate }: OverviewViewProps) {
  const { user } = useAuth();
  const [userName, setUserName] = useState<string>('Chef');
  const [stats, setStats] = useState<Stats>({
    totalRecipes: 0,
    favoriteRecipes: 0,
    creditsRemaining: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch user name from user_extended
        const { data: userData } = await supabase
          .from('user_extended')
          .select('name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (userData?.name) {
          setUserName(userData.name);
        }

        // Fetch recipe count
        const { count: recipeCount } = await supabase
          .from('recipe_user')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Fetch favorites count
        const { count: favCount } = await supabase
          .from('recipe_favorites')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Fetch credits
        const { data: wallet } = await supabase
          .from('credit_wallet')
          .select('balance, daily_remaining')
          .eq('user_id', user.id)
          .maybeSingle();

        setStats({
          totalRecipes: recipeCount || 0,
          favoriteRecipes: favCount || 0,
          creditsRemaining: (wallet?.balance || 0) + (wallet?.daily_remaining || 0),
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const statCards = [
    {
      title: 'My Recipes',
      value: stats.totalRecipes,
      icon: BookOpen,
      color: 'bg-primary/10 text-primary',
      onClick: () => onNavigate('my-recipes'),
    },
    {
      title: 'Favorites',
      value: stats.favoriteRecipes,
      icon: Heart,
      color: 'bg-destructive/10 text-destructive',
      onClick: () => onNavigate('favorites'),
    },
    {
      title: 'Credits',
      value: stats.creditsRemaining,
      icon: Sparkles,
      color: 'bg-accent text-accent-foreground',
      onClick: undefined,
    },
  ];

  const quickActions = [
    {
      title: 'Generate Recipe',
      description: 'Create a new recipe with AI',
      icon: ChefHat,
      onClick: () => onNavigate('generate'),
    },
    {
      title: 'Browse Library',
      description: 'Explore community recipes',
      icon: BookOpen,
      onClick: () => onNavigate('library'),
    },
    {
      title: 'Meal Planner',
      description: 'Plan your weekly meals',
      icon: Clock,
      onClick: () => onNavigate('meal-planner'),
    },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary/10 to-accent/30 rounded-2xl p-6 border border-primary/20"
      >
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Welcome back, {userName}! 👨‍🍳
        </h2>
        <p className="text-muted-foreground">
          Ready to create something delicious today?
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={stat.onClick}
            className={`card-warm p-6 ${stat.onClick ? 'cursor-pointer hover:border-primary/30' : ''}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6" />
              </div>
              {stat.onClick && <TrendingUp className="w-4 h-4 text-muted-foreground" />}
            </div>
            <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
            <p className="text-3xl font-bold text-foreground">
              {isLoading ? '...' : stat.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <motion.button
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onClick={action.onClick}
              className="card-warm p-5 text-left hover:border-primary/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <action.icon className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">{action.title}</h4>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
