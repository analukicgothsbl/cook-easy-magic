import { motion } from 'framer-motion';
import { Clock, Users, RefreshCw, Heart, Lock, Lightbulb, ChefHat, Flame, UserPlus, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import foodPasta from '@/assets/food-pasta.jpg';

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface NutritionEstimate {
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
}

export interface Recipe {
  id?: string;
  title: string;
  description_short?: string;
  description_long?: string;
  mealType?: string;
  meal_category?: string;
  time?: string;
  time_minutes?: number;
  cuisine?: string;
  servings?: number;
  difficulty?: string;
  budget_level?: string;
  kids_friendly?: boolean;
  ingredients: (string | Ingredient)[];
  steps?: string[];
  instructions?: string[];
  tip?: string;
  tips?: string;
  nutrition_estimate?: NutritionEstimate;
}

interface RecipeCardProps {
  recipe: Recipe;
  onGenerateAnother: () => void;
  isLoading?: boolean;
  errorMsg?: string;
  onRetry?: () => void;
  isLoggedIn?: boolean;
  isGuestBlocked?: boolean;
}

// Skeleton loader component
const RecipeSkeleton = () => (
  <section className="section-padding bg-background">
    <div className="container-narrow">
      <div className="card-warm overflow-hidden animate-pulse">
        <div className="h-48 sm:h-64 bg-muted" />
        <div className="p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="flex gap-3">
              <div className="h-6 bg-muted rounded-full w-20" />
              <div className="h-6 bg-muted rounded w-24" />
              <div className="h-6 bg-muted rounded w-24" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-6 bg-muted rounded w-32" />
            <div className="grid gap-2 sm:grid-cols-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-5 bg-muted rounded w-full" />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-6 bg-muted rounded w-32" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-8 w-8 bg-muted rounded-full flex-shrink-0" />
                <div className="h-5 bg-muted rounded flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

export const RecipeCard = ({ 
  recipe, 
  onGenerateAnother, 
  isLoading = false, 
  errorMsg = '', 
  onRetry,
  isLoggedIn = false,
  isGuestBlocked = false
}: RecipeCardProps) => {
  const navigate = useNavigate();

  // Show skeleton while loading
  if (isLoading) {
    return <RecipeSkeleton />;
  }

  // Show guest limit reached CTA
  if (isGuestBlocked) {
    return (
      <section className="section-padding bg-background">
        <div className="container-narrow">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="card-warm p-8 text-center"
          >
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">👋</span>
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3 font-serif">
              You've used your free recipe
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create a free account to unlock more recipes, daily credits, and saved favorites.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <motion.button
                onClick={() => navigate('/auth')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary flex items-center justify-center gap-2 px-6"
              >
                <UserPlus className="w-4 h-4" />
                Create free account
              </motion.button>
              <motion.button
                onClick={() => navigate('/auth')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary flex items-center justify-center gap-2 px-6"
              >
                <LogIn className="w-4 h-4" />
                Login
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>
    );
  }

  // Show error state
  if (errorMsg) {
    return (
      <section className="section-padding bg-background">
        <div className="container-narrow">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="card-warm p-8 text-center"
          >
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">😕</span>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Oops! Something went wrong</h3>
            <p className="text-muted-foreground mb-6">{errorMsg}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {onRetry && (
                <motion.button
                  onClick={onRetry}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try again
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      </section>
    );
  }

  // Parse data from either old or new format
  const displayMealType = recipe.mealType || recipe.meal_category || 'Recipe';
  const displayTime = recipe.time || (recipe.time_minutes ? `${recipe.time_minutes} min` : 'N/A');
  const displayServings = recipe.servings || 2;
  const displayCuisine = recipe.cuisine === 'any_surprise_me' ? 'Surprise' : recipe.cuisine || 'Mixed';
  const displayTip = recipe.tip || recipe.tips;
  const displayInstructions = recipe.steps || recipe.instructions || [];
  
  // Handle ingredients - can be array of strings or objects
  const formattedIngredients = recipe.ingredients.map((ing) => {
    if (typeof ing === 'string') {
      return ing;
    }
    return `${ing.quantity} ${ing.unit} ${ing.name}`.trim();
  });

  return (
    <section className="section-padding bg-background">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="card-warm overflow-hidden"
        >
          {/* Recipe Image (locked for guests) */}
          <div className="relative h-48 sm:h-64 overflow-hidden">
            <img
              src={foodPasta}
              alt={recipe.title}
              className="w-full h-full object-cover blur-sm scale-105"
            />
            <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
              <div className="text-center text-primary-foreground">
                <Lock className="w-8 h-8 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-medium opacity-90">
                  Sign up to see recipe images
                </p>
              </div>
            </div>
          </div>

          {/* Recipe Content */}
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="mb-6">
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground font-serif mb-2">
                {recipe.title}
              </h3>
              {recipe.description_short && (
                <p className="text-muted-foreground mb-3">{recipe.description_short}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full font-medium capitalize">
                  {displayMealType}
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {displayTime}
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {displayServings} servings
                </span>
                {recipe.difficulty && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground capitalize">
                    <ChefHat className="w-4 h-4" />
                    {recipe.difficulty}
                  </span>
                )}
                <span className="text-muted-foreground capitalize">
                  {displayCuisine}
                </span>
              </div>
            </div>

            {/* Nutrition (optional) */}
            {recipe.nutrition_estimate && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-3 mb-6 p-3 bg-secondary/50 rounded-xl"
              >
                <span className="inline-flex items-center gap-1 text-sm">
                  <Flame className="w-4 h-4 text-primary" />
                  <strong>{recipe.nutrition_estimate.calories}</strong> kcal
                </span>
                <span className="text-sm text-muted-foreground">
                  Protein: {recipe.nutrition_estimate.protein}
                </span>
                <span className="text-sm text-muted-foreground">
                  Carbs: {recipe.nutrition_estimate.carbs}
                </span>
                <span className="text-sm text-muted-foreground">
                  Fat: {recipe.nutrition_estimate.fat}
                </span>
              </motion.div>
            )}

            {/* Ingredients */}
            <div className="mb-6">
              <h4 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm">
                  🥘
                </span>
                Ingredients
              </h4>
              <ul className="grid gap-2 sm:grid-cols-2">
                {formattedIngredients.map((ingredient, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-start gap-2 text-foreground"
                  >
                    <span className="text-primary mt-0.5">•</span>
                    {ingredient}
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Steps */}
            <div className="mb-6">
              <h4 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm">
                  📝
                </span>
                Instructions
              </h4>
              <ol className="space-y-4">
                {displayInstructions.map((step, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
                    className="flex gap-4"
                  >
                    <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </span>
                    <p className="text-foreground pt-1">{step}</p>
                  </motion.li>
                ))}
              </ol>
            </div>

            {/* Tip */}
            {displayTip && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="p-4 bg-accent rounded-xl border border-primary/20 mb-6"
              >
                <div className="flex gap-3">
                  <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground text-sm mb-1">Pro tip</p>
                    <p className="text-muted-foreground text-sm">{displayTip}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <motion.button
                onClick={onGenerateAnother}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Generate another recipe
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-outline flex-1 flex items-center justify-center gap-2"
              >
                <Heart className="w-4 h-4" />
                Save recipe
                {!isLoggedIn && <Lock className="w-3 h-3 opacity-60" />}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
