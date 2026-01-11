import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, ChefHat, X, Flame } from 'lucide-react';
import type { Recipe } from '@/components/RecipeCard';

interface RecipeWithMeta extends Recipe {
  id: string;
  created_at: string;
  image_url?: string;
}

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface RecipeDetailModalProps {
  recipe: RecipeWithMeta | null;
  onClose: () => void;
  headerIcon?: React.ReactNode;
}

export function RecipeDetailModal({ recipe, onClose, headerIcon }: RecipeDetailModalProps) {
  const formatIngredient = (ing: string | Ingredient): string => {
    if (typeof ing === 'string') return ing;
    return `${ing.quantity} ${ing.unit} ${ing.name}`.trim();
  };

  const formatCuisine = (cuisine: string | undefined): string => {
    if (!cuisine) return '';
    const cuisineMap: Record<string, string> = {
      any_surprise_me: 'Any',
      home_style_traditional: 'Traditional',
      italian: 'Italian',
      mediterranean: 'Mediterranean',
      mexican: 'Mexican',
      asian: 'Asian',
      balkan: 'Balkan',
      healthy_light: 'Healthy Light',
      comfort_food: 'Comfort Food',
    };
    return cuisineMap[cuisine] || cuisine;
  };

  // Parse instructions - handle both string and array formats
  const getInstructions = (): string[] => {
    if (!recipe?.instructions) return [];
    
    // If it's already an array with proper steps
    if (Array.isArray(recipe.instructions)) {
      // Check if it's a single string that needs splitting
      if (recipe.instructions.length === 1 && typeof recipe.instructions[0] === 'string') {
        const text = recipe.instructions[0];
        // Try to split by numbered pattern (1. or 1) or newlines)
        const steps = text.split(/(?:\d+\.\s*|\d+\)\s*|\n)+/).filter(s => s.trim());
        if (steps.length > 1) return steps;
        // Split by periods followed by capital letter
        return text.split(/\.\s+(?=[A-Z])/).filter(s => s.trim()).map(s => s.endsWith('.') ? s : s + '.');
      }
      return recipe.instructions.filter(s => s && typeof s === 'string' && s.trim());
    }
    
    return [];
  };

  const instructions = getInstructions();

  if (!recipe) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with just X button */}
          <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-end z-10">
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
                {headerIcon}
                {recipe.title}
              </h2>
              
              {/* Short Description */}
              {recipe.description_short && (
                <p className="text-muted-foreground">{recipe.description_short}</p>
              )}
            </div>

            {/* Meta Row - matching screenshot style */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {recipe.meal_category && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full font-medium capitalize">
                  {recipe.meal_category}
                </span>
              )}
              {recipe.time_minutes && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {recipe.time_minutes} min
                </span>
              )}
              {recipe.servings && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {recipe.servings} servings
                </span>
              )}
              {recipe.difficulty && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground capitalize">
                  <ChefHat className="w-4 h-4" />
                  {recipe.difficulty}
                </span>
              )}
              {recipe.cuisine && (
                <span className="text-muted-foreground capitalize">
                  {formatCuisine(recipe.cuisine)}
                </span>
              )}
            </div>

            {/* Nutrition Estimate - inline style like screenshot */}
            {recipe.nutrition_estimate && (
              <div className="flex flex-wrap gap-3 p-3 bg-secondary/50 rounded-xl">
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
              </div>
            )}

            {/* Ingredients - 2 column layout */}
            {recipe.ingredients && recipe.ingredients.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm">
                    🥘
                  </span>
                  Ingredients
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2 text-foreground">
                      <span className="text-primary mt-0.5">•</span>
                      {formatIngredient(ing)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Instructions - numbered steps */}
            {instructions.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm">
                    📝
                  </span>
                  Instructions
                </h3>
                <ol className="space-y-4">
                  {instructions.map((step, i) => (
                    <li key={i} className="flex gap-4">
                      <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                        {i + 1}
                      </span>
                      <p className="text-foreground pt-1">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Tips */}
            {recipe.tips && (
              <div className="p-4 bg-accent rounded-xl border border-primary/20">
                <p className="font-semibold text-foreground text-sm mb-1">💡 Pro tip</p>
                <p className="text-muted-foreground text-sm">{recipe.tips}</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
