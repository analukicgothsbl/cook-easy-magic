import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, ChefHat, Loader2, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
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

const MEAL_CATEGORIES = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'] as const;
const RECIPES_PER_CATEGORY = 6;

const categoryLabels: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
  snack: 'Snack',
  other: 'Other',
};

interface CategoryPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function CategoryPagination({ currentPage, totalPages, onPageChange }: CategoryPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-2 mt-4">
      <button
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border border-border hover:bg-primary/10 hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4 text-foreground" />
      </button>
      
      <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === page
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
            }`}
          >
            {page}
          </button>
        ))}
      </div>
      
      <button
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg border border-border hover:bg-primary/10 hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-foreground" />
      </button>
    </div>
  );
}

interface CategorySectionProps {
  category: string;
  recipes: RecipeWithMeta[];
  recipeImages: Record<string, string>;
  onRecipeClick: (recipe: RecipeWithMeta) => void;
}

function CategorySection({ category, recipes, recipeImages, onRecipeClick }: CategorySectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(recipes.length / RECIPES_PER_CATEGORY);
  const paginatedRecipes = useMemo(() => {
    const startIndex = (currentPage - 1) * RECIPES_PER_CATEGORY;
    return recipes.slice(startIndex, startIndex + RECIPES_PER_CATEGORY);
  }, [recipes, currentPage]);

  return (
    <div className="mb-8">
      {/* Category Header */}
      <h2 className="text-lg font-semibold text-foreground capitalize mb-2">
        {categoryLabels[category] || category}
      </h2>
      <div className="h-px bg-border mb-4" />

      {/* Recipes Grid - 2 columns on desktop, 1 on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paginatedRecipes.map((recipe, index) => (
          <motion.div
            key={recipe.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="card-warm overflow-hidden cursor-pointer hover:border-primary/30 transition-colors flex flex-row"
            onClick={() => onRecipeClick(recipe)}
          >
            {/* Square Recipe Image */}
            <div className="w-28 h-28 md:w-32 md:h-32 flex-shrink-0 bg-gradient-to-br from-destructive/10 to-primary/10 flex items-center justify-center overflow-hidden">
              {recipeImages[recipe.id] ? (
                <img 
                  src={recipeImages[recipe.id]} 
                  alt={recipe.title} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <ChefHat className="w-10 h-10 text-primary/40" />
              )}
            </div>
            
            {/* Content */}
            <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
              <div>
                <h3 className="font-bold text-foreground mb-1 line-clamp-1 text-sm md:text-base">
                  {recipe.title}
                </h3>
                {recipe.description_short && (
                  <p className="text-xs md:text-sm text-muted-foreground mb-2 line-clamp-2">
                    {recipe.description_short}
                  </p>
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {recipe.meal_category && (
                    <span className="text-primary capitalize">
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
                <div className="flex items-center justify-between mt-2">
                  <button className="text-xs md:text-sm text-primary font-medium hover:underline">
                    Show more...
                  </button>
                  <Heart className="w-4 h-4 text-destructive fill-destructive" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Category Pagination */}
      <CategoryPagination 
        currentPage={currentPage} 
        totalPages={totalPages} 
        onPageChange={setCurrentPage} 
      />
    </div>
  );
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

  // Group recipes by meal category
  const recipesByCategory = useMemo(() => {
    const grouped: Record<string, RecipeWithMeta[]> = {};
    
    MEAL_CATEGORIES.forEach(category => {
      grouped[category] = recipes.filter(r => r.meal_category === category);
    });
    
    // Add uncategorized recipes
    const uncategorized = recipes.filter(r => !r.meal_category || !MEAL_CATEGORIES.includes(r.meal_category as typeof MEAL_CATEGORIES[number]));
    if (uncategorized.length > 0) {
      grouped['other'] = uncategorized;
    }
    
    return grouped;
  }, [recipes]);

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
      {MEAL_CATEGORIES.map((category) => {
        const categoryRecipes = recipesByCategory[category];
        if (!categoryRecipes || categoryRecipes.length === 0) return null;

        return (
          <CategorySection
            key={category}
            category={category}
            recipes={categoryRecipes}
            recipeImages={recipeImages}
            onRecipeClick={setSelectedRecipe}
          />
        );
      })}

      {/* Uncategorized recipes */}
      {recipesByCategory['other'] && recipesByCategory['other'].length > 0 && (
        <CategorySection
          category="other"
          recipes={recipesByCategory['other']}
          recipeImages={recipeImages}
          onRecipeClick={setSelectedRecipe}
        />
      )}

      {/* Full Recipe Modal */}
      <RecipeDetailModal 
        recipe={selectedRecipe} 
        onClose={() => setSelectedRecipe(null)}
        headerIcon={<Heart className="w-5 h-5 text-destructive fill-destructive" />}
      />
    </div>
  );
}
