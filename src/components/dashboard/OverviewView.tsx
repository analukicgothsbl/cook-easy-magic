import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChefHat, Heart, BookOpen, Clock, UtensilsCrossed, Flame } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardView } from '@/pages/Dashboard';
import { Progress } from '@/components/ui/progress';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

interface OverviewViewProps {
  onNavigate: (view: DashboardView) => void;
}

interface Stats {
  totalRecipes: number;
  favoriteRecipes: number;
  favoriteCuisine: string;
  favoriteMeal: string;
}

interface CreditWallet {
  balance: number;
  dailyRemaining: number;
}

const cuisineLabels: Record<string, string> = {
  'any_surprise_me': 'Any / Surprise Me',
  'home_style_traditional': 'Home Style',
  'italian': 'Italian',
  'mediterranean': 'Mediterranean',
  'mexican': 'Mexican',
  'asian': 'Asian',
  'balkan': 'Balkan',
  'healthy_light': 'Healthy & Light',
  'comfort_food': 'Comfort Food',
};

const mealLabels: Record<string, string> = {
  'breakfast': 'Breakfast',
  'lunch': 'Lunch',
  'dinner': 'Dinner',
  'dessert': 'Dessert',
  'snack': 'Snack',
};

export function OverviewView({ onNavigate }: OverviewViewProps) {
  const { user } = useAuth();
  const [userName, setUserName] = useState<string>('Chef');
  const [stats, setStats] = useState<Stats>({
    totalRecipes: 0,
    favoriteRecipes: 0,
    favoriteCuisine: '-',
    favoriteMeal: '-',
  });
  const [wallet, setWallet] = useState<CreditWallet>({
    balance: 0,
    dailyRemaining: 0,
  });
  const [cuisineData, setCuisineData] = useState<{ name: string; value: number }[]>([]);
  const [mealData, setMealData] = useState<{ name: string; value: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; recipes: number }[]>([]);
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
        const { data: walletData } = await supabase
          .from('credit_wallet')
          .select('balance, daily_remaining')
          .eq('user_id', user.id)
          .maybeSingle();

        setWallet({
          balance: walletData?.balance || 0,
          dailyRemaining: walletData?.daily_remaining || 0,
        });

        // Fetch favorite recipes with cuisine and meal_category for analysis
        const { data: favorites } = await supabase
          .from('recipe_favorites')
          .select('recipe:recipe_id(cuisine, meal_category, created_at)')
          .eq('user_id', user.id);

        // Calculate favorite cuisine and meal
        const cuisineCounts: Record<string, number> = {};
        const mealCounts: Record<string, number> = {};

        favorites?.forEach((fav) => {
          const recipe = fav.recipe as { cuisine: string | null; meal_category: string | null; created_at: string } | null;
          if (recipe?.cuisine) {
            cuisineCounts[recipe.cuisine] = (cuisineCounts[recipe.cuisine] || 0) + 1;
          }
          if (recipe?.meal_category) {
            mealCounts[recipe.meal_category] = (mealCounts[recipe.meal_category] || 0) + 1;
          }
        });

        // Find most frequent cuisine and meal
        let topCuisine = '-';
        let topMeal = '-';
        let maxCuisine = 0;
        let maxMeal = 0;

        Object.entries(cuisineCounts).forEach(([cuisine, count]) => {
          if (count > maxCuisine) {
            maxCuisine = count;
            topCuisine = cuisineLabels[cuisine] || cuisine;
          }
        });

        Object.entries(mealCounts).forEach(([meal, count]) => {
          if (count > maxMeal) {
            maxMeal = count;
            topMeal = mealLabels[meal] || meal;
          }
        });

        // Prepare chart data for cuisines
        const cuisineChartData = Object.entries(cuisineCounts)
          .map(([key, value]) => ({
            name: cuisineLabels[key] || key,
            value,
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        setCuisineData(cuisineChartData);

        // Prepare chart data for meals
        const mealChartData = Object.entries(mealCounts)
          .map(([key, value]) => ({
            name: mealLabels[key] || key,
            value,
          }))
          .sort((a, b) => b.value - a.value);

        setMealData(mealChartData);

        // Fetch recipes created in the last 7 days for the line chart
        const { data: userRecipes } = await supabase
          .from('recipe_user')
          .select('created_at')
          .eq('user_id', user.id);

        // Group by day for last 7 days
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();
        const weekData: { day: string; recipes: number }[] = [];
        
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const dayName = days[date.getDay()];
          const dateStr = date.toISOString().split('T')[0];
          
          const count = userRecipes?.filter((r) => {
            const recipeDate = new Date(r.created_at).toISOString().split('T')[0];
            return recipeDate === dateStr;
          }).length || 0;

          weekData.push({ day: dayName, recipes: count });
        }

        setWeeklyData(weekData);

        setStats({
          totalRecipes: recipeCount || 0,
          favoriteRecipes: favCount || 0,
          favoriteCuisine: topCuisine,
          favoriteMeal: topMeal,
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const totalCredits = wallet.balance + wallet.dailyRemaining;
  const maxDisplayCredits = Math.max(totalCredits, 10); // Minimum scale of 10 for the bar
  const balancePercent = (wallet.balance / maxDisplayCredits) * 100;
  const dailyPercent = (wallet.dailyRemaining / maxDisplayCredits) * 100;

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
      title: 'Favorite Cuisine',
      value: stats.favoriteCuisine,
      icon: UtensilsCrossed,
      color: 'bg-orange-500/10 text-orange-500',
      onClick: undefined,
    },
    {
      title: 'Favorite Meal',
      value: stats.favoriteMeal,
      icon: Flame,
      color: 'bg-emerald-500/10 text-emerald-500',
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

  const chartConfig: ChartConfig = {
    value: {
      label: 'Count',
      color: 'hsl(var(--primary))',
    },
    recipes: {
      label: 'Recipes',
      color: 'hsl(var(--primary))',
    },
  };

  const pieColors = [
    'hsl(var(--primary))',
    'hsl(var(--destructive))',
    'hsl(25, 95%, 53%)', // orange
    'hsl(142, 71%, 45%)', // emerald
    'hsl(262, 83%, 58%)', // purple
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

      {/* Credits Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card-warm p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground">Credits</span>
          <span className="text-sm text-muted-foreground">
            {isLoading ? '...' : `${totalCredits.toFixed(1)} left`}
          </span>
        </div>
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          {/* Balance portion (blue) */}
          <div
            className="absolute left-0 top-0 h-full bg-primary transition-all duration-500"
            style={{ width: `${balancePercent}%` }}
          />
          {/* Daily remaining portion (lighter blue/cyan) */}
          <div
            className="absolute top-0 h-full bg-sky-400 transition-all duration-500"
            style={{ left: `${balancePercent}%`, width: `${dailyPercent}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span>Balance: {wallet.balance.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span>Daily Bonus: {wallet.dailyRemaining.toFixed(1)}</span>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
            onClick={stat.onClick}
            className={`card-warm p-5 ${stat.onClick ? 'cursor-pointer hover:border-primary/30' : ''}`}
          >
            <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">{stat.title}</p>
            <p className="text-xl font-bold text-foreground truncate">
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

      {/* Charts Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Statistics</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Activity Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card-warm p-5"
          >
            <h4 className="font-medium text-foreground mb-4">Recipes Created (Last 7 Days)</h4>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <LineChart data={weeklyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="recipes"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </motion.div>

          {/* Meal Distribution Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="card-warm p-5"
          >
            <h4 className="font-medium text-foreground mb-4">Favorite Meals Distribution</h4>
            {mealData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart data={mealData} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 0 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={55} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No favorite recipes yet
              </div>
            )}
          </motion.div>

          {/* Cuisine Distribution Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card-warm p-5 lg:col-span-2"
          >
            <h4 className="font-medium text-foreground mb-4">Top Cuisines</h4>
            {cuisineData.length > 0 ? (
              <div className="flex flex-col md:flex-row items-center gap-6">
                <ChartContainer config={chartConfig} className="h-[200px] w-full md:w-[250px]">
                  <PieChart>
                    <Pie
                      data={cuisineData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {cuisineData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap gap-3">
                  {cuisineData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: pieColors[index % pieColors.length] }}
                      />
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium text-foreground">({item.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No favorite recipes yet
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
