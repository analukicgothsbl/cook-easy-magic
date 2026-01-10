import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, ChefHat, X, Loader2, BookOpen, Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Recipe } from '@/components/RecipeCard';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';

interface RecipeWithMeta extends Recipe {
  id: string;
  created_at: string;
}

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

export function MyRecipesView() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<RecipeWithMeta[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithMeta | null>(null);
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch user's favorite recipe IDs
        const { data: favData } = await supabase
          .from('recipe_favorites')
          .select('recipe_id')
          .eq('user_id', user.id);

        if (favData) {
          setFavoriteIds(new Set(favData.map(f => f.recipe_id)));
        }

        // Fetch recipes
        const { data, error } = await supabase
          .from('recipe_user')
          .select(`
            recipe_id,
            created_at,
            recipe:recipe_id (
              id,
              title,
              description_short,
              description_long,
              meal_category,
              time_minutes,
              cuisine,
              servings,
              difficulty,
              budget_level,
              kids_friendly,
              ingredients,
              instructions,
              tips,
              nutrition_estimate
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching recipes:', error);
          return;
        }

        const formattedRecipes: RecipeWithMeta[] = (data || [])
          .filter((item) => item.recipe)
          .map((item) => {
            const recipe = item.recipe as unknown as {
              id: string;
              title: string;
              description_short: string | null;
              description_long: string | null;
              meal_category: string | null;
              time_minutes: number | null;
              cuisine: string | null;
              servings: number | null;
              difficulty: string | null;
              budget_level: string | null;
              kids_friendly: boolean | null;
              ingredients: Json[] | null;
              instructions: string | null;
              tips: string | null;
              nutrition_estimate: Json | null;
            };
            
            return {
              id: recipe.id,
              title: recipe.title,
              description_short: recipe.description_short || undefined,
              description_long: recipe.description_long || undefined,
              meal_category: recipe.meal_category || undefined,
              time_minutes: recipe.time_minutes || undefined,
              cuisine: recipe.cuisine || undefined,
              servings: recipe.servings || undefined,
              difficulty: recipe.difficulty || undefined,
              budget_level: recipe.budget_level || undefined,
              kids_friendly: recipe.kids_friendly || undefined,
              ingredients: (recipe.ingredients || []) as (string | Ingredient)[],
              instructions: recipe.instructions ? [recipe.instructions] : [],
              tips: recipe.tips || undefined,
              nutrition_estimate: recipe.nutrition_estimate as unknown as Recipe['nutrition_estimate'],
              created_at: item.created_at,
            };
          });

        setRecipes(formattedRecipes);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const toggleFavorite = async (e: React.MouseEvent, recipeId: string) => {
    e.stopPropagation();
    if (!user || togglingFavorite) return;

    setTogglingFavorite(recipeId);
    const isFavorited = favoriteIds.has(recipeId);

    try {
      if (isFavorited) {
        // Remove from favorites
        const { error } = await supabase
          .from('recipe_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('recipe_id', recipeId);

        if (error) throw error;

        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.delete(recipeId);
          return next;
        });
        toast.success('Removed from favorites');
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('recipe_favorites')
          .insert({ user_id: user.id, recipe_id: recipeId });

        if (error) {
          if (error.code === '23505') {
            toast.info('Already in favorites');
          } else {
            throw error;
          }
        } else {
          setFavoriteIds(prev => new Set(prev).add(recipeId));
          toast.success('Added to favorites');
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    } finally {
      setTogglingFavorite(null);
    }
  };

  const formatIngredient = (ing: string | Ingredient): string => {
    if (typeof ing === 'string') return ing;
    return `${ing.quantity} ${ing.unit} ${ing.name}`.trim();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">No recipes yet</h3>
        <p className="text-muted-foreground">
          Generate your first recipe to see it here!
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recipes.map((recipe, index) => (
          <motion.div
            key={recipe.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="card-warm overflow-hidden cursor-pointer hover:border-primary/30 transition-colors relative"
            onClick={() => setSelectedRecipe(recipe)}
          >
            {/* Preview Image Placeholder */}
            <div className="h-40 bg-gradient-to-br from-primary/10 to-accent/20 flex items-center justify-center">
              <ChefHat className="w-12 h-12 text-primary/40" />
            </div>
            
            {/* Content */}
            <div className="p-4">
              <h3 className="font-bold text-foreground mb-2 line-clamp-1">
                {recipe.title}
              </h3>
              {recipe.description_short && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {recipe.description_short}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {recipe.meal_category && (
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded-full capitalize">
                    {recipe.meal_category}
                  </span>
                )}
                {recipe.time_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {recipe.time_minutes} min
                  </span>
                )}
                {recipe.servings && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {recipe.servings}
                  </span>
                )}
              </div>
              <button className="mt-3 text-sm text-primary font-medium hover:underline">
                Show more...
              </button>
              
              {/* Favorite Heart */}
              <button
                onClick={(e) => toggleFavorite(e, recipe.id)}
                disabled={togglingFavorite === recipe.id}
                className="absolute bottom-4 right-4 p-2 rounded-full bg-background/80 hover:bg-background transition-colors"
              >
                <Heart
                  className={`w-5 h-5 transition-colors ${
                    favoriteIds.has(recipe.id)
                      ? 'text-destructive fill-destructive'
                      : 'text-muted-foreground hover:text-destructive'
                  } ${togglingFavorite === recipe.id ? 'animate-pulse' : ''}`}
                />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Full Recipe Modal */}
      <AnimatePresence>
        {selectedRecipe && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedRecipe(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold text-foreground">{selectedRecipe.title}</h2>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Meta Info */}
                <div className="flex flex-wrap gap-3 text-sm">
                  {selectedRecipe.meal_category && (
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full capitalize">
                      {selectedRecipe.meal_category}
                    </span>
                  )}
                  {selectedRecipe.time_minutes && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {selectedRecipe.time_minutes} min
                    </span>
                  )}
                  {selectedRecipe.servings && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {selectedRecipe.servings} servings
                    </span>
                  )}
                  {selectedRecipe.difficulty && (
                    <span className="flex items-center gap-1 text-muted-foreground capitalize">
                      <ChefHat className="w-4 h-4" />
                      {selectedRecipe.difficulty}
                    </span>
                  )}
                </div>

                {/* Description */}
                {selectedRecipe.description_long && (
                  <p className="text-muted-foreground">{selectedRecipe.description_long}</p>
                )}

                {/* Ingredients */}
                <div>
                  <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm">
                      🥘
                    </span>
                    Ingredients
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <li key={i} className="flex items-start gap-2 text-foreground">
                        <span className="text-primary">•</span>
                        {formatIngredient(ing)}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructions */}
                {selectedRecipe.instructions && selectedRecipe.instructions.length > 0 && (
                  <div>
                    <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm">
                        📝
                      </span>
                      Instructions
                    </h3>
                    <ol className="space-y-3">
                      {selectedRecipe.instructions.map((step, i) => (
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
                {selectedRecipe.tips && (
                  <div className="p-4 bg-accent rounded-xl border border-primary/20">
                    <p className="font-semibold text-foreground text-sm mb-1">💡 Pro tip</p>
                    <p className="text-muted-foreground text-sm">{selectedRecipe.tips}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
