import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, ChefHat, Loader2, Heart } from 'lucide-react';
import { RecipeDetailModal } from './RecipeDetailModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Recipe } from '@/components/RecipeCard';
import type { Json } from '@/integrations/supabase/types';

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

export function FavoriteRecipesView() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<RecipeWithMeta[]>([]);
  const [recipeImages, setRecipeImages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithMeta | null>(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('recipe_favorites')
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
          console.error('Error fetching favorites:', error);
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

        // Fetch recipe images
        if (formattedRecipes.length > 0) {
          const recipeIds = formattedRecipes.map(r => r.id);
          const { data: imageData } = await supabase
            .from('recipe_image')
            .select('recipe_id, image_url')
            .in('recipe_id', recipeIds);

          if (imageData) {
            const imageMap: Record<string, string> = {};
            imageData.forEach(img => {
              if (img.image_url) {
                imageMap[img.recipe_id] = img.image_url;
              }
            });
            setRecipeImages(imageMap);
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavorites();
  }, [user]);

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
        <Heart className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">No favorites yet</h3>
        <p className="text-muted-foreground">
          Save recipes you love to see them here!
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
            className="card-warm overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => setSelectedRecipe(recipe)}
          >
            {/* Recipe Image */}
            <div className="h-40 bg-gradient-to-br from-destructive/10 to-primary/10 flex items-center justify-center relative overflow-hidden">
              {recipeImages[recipe.id] ? (
                <img 
                  src={recipeImages[recipe.id]} 
                  alt={recipe.title} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <ChefHat className="w-12 h-12 text-primary/40" />
              )}
              <Heart className="absolute top-3 right-3 w-5 h-5 text-destructive fill-destructive" />
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
            </div>
          </motion.div>
        ))}
      </div>

      {/* Full Recipe Modal */}
      <RecipeDetailModal 
        recipe={selectedRecipe} 
        onClose={() => setSelectedRecipe(null)}
        headerIcon={<Heart className="w-5 h-5 text-destructive fill-destructive" />}
      />
    </div>
  );
}
