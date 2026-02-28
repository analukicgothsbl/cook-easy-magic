import { useState, useEffect, useMemo } from 'react';
import { ChefHat, Loader2, Heart, BookOpen, Clock, Users, FileDown, ChevronDown, ChevronRight, Coffee, Cookie, Salad, CakeSlice, Flame, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Recipe } from '@/components/RecipeCard';
import type { Json } from '@/integrations/supabase/types';
import { generateCookbookPdf } from '@/lib/generateCookbookPdf';
import { useToast } from '@/hooks/use-toast';

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

const categoryLabels: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
  snack: 'Snack',
  other: 'Other',
};

const categoryIcons: Record<string, { Icon: LucideIcon; color: string }> = {
  breakfast: { Icon: Coffee, color: 'bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400' },
  lunch: { Icon: Salad, color: 'bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400' },
  dinner: { Icon: Flame, color: 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400' },
  dessert: { Icon: CakeSlice, color: 'bg-pink-100 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400' },
  snack: { Icon: Cookie, color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' },
  other: { Icon: UtensilsCrossed, color: 'bg-muted text-muted-foreground' },
};

const difficultyColors: Record<string, string> = {
  easy: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/30',
  medium: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30',
  hard: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30',
};

function CategorySection({
  category,
  recipes,
}: {
  category: string;
  recipes: RecipeWithMeta[];
}) {
  const [open, setOpen] = useState(true);
  const label = categoryLabels[category] || category;
  const iconData = categoryIcons[category] || categoryIcons.other;
  const IconComp = iconData.Icon;

  return (
    <div className="card-warm overflow-hidden">
      {/* Category header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${iconData.color} flex items-center justify-center flex-shrink-0`}>
            <IconComp className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground text-base">{label}</h3>
            <p className="text-xs text-muted-foreground">
              {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {recipes.length}
          </span>
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Recipe list */}
      {open && (
        <div className="border-t border-border/50 divide-y divide-border/40">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="flex items-center gap-4 px-5 py-3 hover:bg-accent/20 transition-colors"
            >
              <Heart className="w-3 h-3 text-destructive fill-destructive flex-shrink-0" />

              <span className="flex-1 text-sm font-medium text-foreground leading-snug">
                {recipe.title}
              </span>

              <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                {recipe.time_minutes && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {recipe.time_minutes}m
                  </span>
                )}
                {recipe.servings && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    {recipe.servings}
                  </span>
                )}
                {recipe.difficulty && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${difficultyColors[recipe.difficulty] || 'text-muted-foreground bg-muted'}`}>
                    {recipe.difficulty}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CookbookView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<RecipeWithMeta[]>([]);
  const [recipeImages, setRecipeImages] = useState<Record<string, string>>({});
  const [userName, setUserName] = useState<string>('My');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchUserName = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('user_extended')
        .select('name')
        .eq('user_id', user.id)
        .single();
      if (data?.name) {
        setUserName(data.name.split(' ')[0]);
      }
    };
    fetchUserName();
  }, [user]);

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
              id, title, description_short, description_long,
              meal_category, time_minutes, cuisine, servings,
              difficulty, budget_level, kids_friendly,
              ingredients, instructions, tips, nutrition_estimate
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const formatted: RecipeWithMeta[] = (data || [])
          .filter((item) => item.recipe)
          .map((item) => {
            const r = item.recipe as unknown as {
              id: string; title: string;
              description_short: string | null; description_long: string | null;
              meal_category: string | null; time_minutes: number | null;
              cuisine: string | null; servings: number | null;
              difficulty: string | null; budget_level: string | null;
              kids_friendly: boolean | null; ingredients: Json[] | null;
              instructions: string | null; tips: string | null;
              nutrition_estimate: Json | null;
            };
            return {
              id: r.id, title: r.title,
              description_short: r.description_short || undefined,
              description_long: r.description_long || undefined,
              meal_category: r.meal_category || undefined,
              time_minutes: r.time_minutes || undefined,
              cuisine: r.cuisine || undefined,
              servings: r.servings || undefined,
              difficulty: r.difficulty || undefined,
              budget_level: r.budget_level || undefined,
              kids_friendly: r.kids_friendly || undefined,
              ingredients: (r.ingredients || []) as (string | Ingredient)[],
              instructions: r.instructions ? [r.instructions] : [],
              tips: r.tips || undefined,
              nutrition_estimate: r.nutrition_estimate as unknown as Recipe['nutrition_estimate'],
              created_at: item.created_at,
            };
          });

        setRecipes(formatted);

        if (formatted.length > 0) {
          const { data: imageData } = await supabase
            .from('recipe_image')
            .select('recipe_id, image_url')
            .in('recipe_id', formatted.map((r) => r.id));

          if (imageData) {
            const map: Record<string, string> = {};
            imageData.forEach((img) => { if (img.image_url) map[img.recipe_id] = img.image_url; });
            setRecipeImages(map);
          }
        }
      } catch (err) {
        console.error('Error fetching favorites:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFavorites();
  }, [user]);

  const recipesByCategory = useMemo(() => {
    const grouped: Record<string, RecipeWithMeta[]> = {};
    MEAL_CATEGORIES.forEach((cat) => {
      const catRecipes = recipes.filter((r) => r.meal_category === cat);
      catRecipes.sort((a, b) => a.title.localeCompare(b.title));
      if (catRecipes.length > 0) grouped[cat] = catRecipes;
    });
    const uncategorized = recipes.filter(
      (r) => !r.meal_category || !MEAL_CATEGORIES.includes(r.meal_category as typeof MEAL_CATEGORIES[number])
    );
    if (uncategorized.length > 0) {
      uncategorized.sort((a, b) => a.title.localeCompare(b.title));
      grouped['other'] = uncategorized;
    }
    return grouped;
  }, [recipes]);

  const handleGeneratePdf = async () => {
    if (Object.keys(recipesByCategory).length === 0) return;
    setIsGenerating(true);
    try {
      await generateCookbookPdf(recipesByCategory, recipeImages, userName);
      toast({ title: 'Cookbook PDF ready!', description: 'Your cookbook has been downloaded.' });
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast({ title: 'Error', description: 'Failed to generate cookbook PDF.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
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
      <div className="flex flex-col items-center justify-center h-64 text-center p-6 gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <ChefHat className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-foreground mb-1">Your cookbook is empty</h3>
          <p className="text-muted-foreground text-sm">
            Add recipes to your favorites to see them collected here.
          </p>
        </div>
      </div>
    );
  }

  const totalCategories = Object.keys(recipesByCategory).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header — matches Overview welcome banner */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/30 rounded-2xl p-6 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            {userName}'s Cook Book
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {recipes.length} favorite recipe{recipes.length !== 1 ? 's' : ''} across {totalCategories} categor{totalCategories !== 1 ? 'ies' : 'y'}
          </p>
        </div>

        <button
          onClick={handleGeneratePdf}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm flex-shrink-0"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}
          {isGenerating ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      {/* Stats row — one per category, single row */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {Object.entries(recipesByCategory).map(([cat, recs]) => (
          <div key={cat} className="card-warm p-4 text-center flex-1 min-w-[90px]">
            <div className={`w-10 h-10 rounded-xl ${(categoryIcons[cat] || categoryIcons.other).color} flex items-center justify-center mx-auto mb-1`}>
              {(() => { const I = (categoryIcons[cat] || categoryIcons.other).Icon; return <I className="w-5 h-5" />; })()}
            </div>
            <div className="text-xl font-bold text-foreground">{recs.length}</div>
            <div className="text-xs text-muted-foreground capitalize mt-0.5">{categoryLabels[cat] || cat}</div>
          </div>
        ))}
      </div>

      {/* Categorized recipe list */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Recipes by Category</h3>
        <div className="space-y-3">
          {Object.entries(recipesByCategory).map(([cat, recs]) => (
            <CategorySection key={cat} category={cat} recipes={recs} />
          ))}
        </div>
      </div>

      {/* PDF info note */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        The PDF includes a cover page, table of contents, and a full page for each recipe with ingredients and instructions.
      </p>
    </div>
  );
}
