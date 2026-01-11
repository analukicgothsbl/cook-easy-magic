import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Clock, Users, ChefHat, Loader2, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Recipe } from '@/components/RecipeCard';
import type { Json } from '@/integrations/supabase/types';
import React from 'react';

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

const formatIngredient = (ing: string | Ingredient): string => {
  if (typeof ing === 'string') return ing;
  const parts = [];
  if (ing.quantity) parts.push(ing.quantity);
  if (ing.unit) parts.push(ing.unit);
  if (ing.name) parts.push(ing.name);
  return parts.join(' ');
};

// Page component that forwards ref (required by react-pageflip)
const Page = React.forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
  ({ children, className = '' }, ref) => {
    return (
      <div ref={ref} className={`page-content ${className}`}>
        {children}
      </div>
    );
  }
);
Page.displayName = 'Page';

// Cover page component
const CoverPage = React.forwardRef<HTMLDivElement, { userName: string }>(
  ({ userName }, ref) => (
    <div ref={ref} className="h-full bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-950 flex flex-col items-center justify-center p-8 rounded-r-lg shadow-inner">
      <div className="text-center">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
          <ChefHat className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
          {userName}'s
        </h1>
        <h2 className="text-3xl md:text-4xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
          Cook Book
        </h2>
        <div className="mt-8 flex items-center justify-center gap-2">
          <Heart className="w-4 h-4 text-destructive fill-destructive" />
          <span className="text-sm text-muted-foreground">Favorite Recipes Collection</span>
          <Heart className="w-4 h-4 text-destructive fill-destructive" />
        </div>
      </div>
      <div className="absolute bottom-6 right-6 text-xs text-muted-foreground">
        Turn the page →
      </div>
    </div>
  )
);
CoverPage.displayName = 'CoverPage';

// Back cover
const BackCover = React.forwardRef<HTMLDivElement, object>((_, ref) => (
  <div ref={ref} className="h-full bg-gradient-to-bl from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-950 flex flex-col items-center justify-center p-8 rounded-l-lg shadow-inner">
    <div className="text-center">
      <ChefHat className="w-16 h-16 text-primary/50 mx-auto mb-4" />
      <p className="text-muted-foreground text-sm">Made with love</p>
      <p className="text-muted-foreground text-xs mt-2">Cook Master</p>
    </div>
  </div>
));
BackCover.displayName = 'BackCover';

// Category divider page
const CategoryPage = React.forwardRef<HTMLDivElement, { category: string; isLeft: boolean }>(
  ({ category, isLeft }, ref) => (
    <div ref={ref} className={`h-full bg-card flex flex-col items-center justify-center p-6 ${isLeft ? 'rounded-r-sm' : 'rounded-l-sm'} border border-border/30`}>
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <ChefHat className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-primary capitalize" style={{ fontFamily: "'Playfair Display', serif" }}>
          {categoryLabels[category] || category}
        </h2>
        <div className="mt-4 h-0.5 w-24 mx-auto bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>
    </div>
  )
);
CategoryPage.displayName = 'CategoryPage';

// Blank page for spacing
const BlankPage = React.forwardRef<HTMLDivElement, { isLeft: boolean }>(
  ({ isLeft }, ref) => (
    <div ref={ref} className={`h-full bg-card ${isLeft ? 'rounded-r-sm' : 'rounded-l-sm'} border border-border/30`}>
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 opacity-5">
          <ChefHat className="w-full h-full text-muted-foreground" />
        </div>
      </div>
    </div>
  )
);
BlankPage.displayName = 'BlankPage';

// Recipe page component
const RecipePage = React.forwardRef<HTMLDivElement, { 
  recipe: RecipeWithMeta; 
  imageUrl?: string;
  isLeft: boolean;
}>(
  ({ recipe, imageUrl, isLeft }, ref) => {
    const ingredients = (recipe.ingredients || []) as (string | Ingredient)[];
    
    // Handle instructions which can be string, string[], or other formats
    const getInstructions = (): string[] => {
      const inst = recipe.instructions as unknown;
      if (!inst) return [];
      if (Array.isArray(inst)) {
        return inst.map(i => String(i));
      }
      if (typeof inst === 'string') {
        return inst.split('\n').filter(Boolean);
      }
      return [];
    };
    const instructions = getInstructions();

    return (
      <div ref={ref} className={`h-full bg-card p-3 overflow-hidden ${isLeft ? 'rounded-r-sm' : 'rounded-l-sm'} border border-border/30`}>
        <div className="h-full flex flex-col">
          {/* Recipe Image - smaller */}
          <div className="w-full h-16 md:h-20 mb-2 rounded-lg overflow-hidden bg-gradient-to-br from-primary/10 to-accent flex-shrink-0">
            {imageUrl ? (
              <img src={imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ChefHat className="w-8 h-8 text-primary/30" />
              </div>
            )}
          </div>

          {/* Recipe Title */}
          <h3 className="text-sm md:text-base font-bold text-foreground mb-1 line-clamp-1" style={{ fontFamily: "'Playfair Display', serif" }}>
            {recipe.title}
          </h3>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground mb-1 flex-shrink-0">
            {recipe.time_minutes && (
              <span className="flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                {recipe.time_minutes}m
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-0.5">
                <Users className="w-2.5 h-2.5" />
                {recipe.servings}
              </span>
            )}
            {recipe.difficulty && (
              <span className="capitalize text-primary">
                {recipe.difficulty}
              </span>
            )}
          </div>

          {/* Content - Ingredients & Instructions - Scrollable */}
          <div className="flex-1 overflow-y-auto text-[10px] space-y-2 pr-1 min-h-0">
            {/* Ingredients - Full List */}
            <div>
              <h4 className="font-semibold text-foreground mb-1 sticky top-0 bg-card">Ingredients</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                {ingredients.map((ing, idx) => (
                  <li key={idx} className="leading-tight">{formatIngredient(ing)}</li>
                ))}
              </ul>
            </div>

            {/* Instructions - Full List */}
            <div>
              <h4 className="font-semibold text-foreground mb-1 sticky top-0 bg-card">Instructions</h4>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                {instructions.map((step, idx) => (
                  <li key={idx} className="leading-tight">{typeof step === 'string' ? step.replace(/^\d+\.\s*/, '') : step}</li>
                ))}
              </ol>
            </div>
          </div>

          {/* Footer with heart */}
          <div className="flex items-center justify-end pt-1 border-t border-border/50 mt-1 flex-shrink-0">
            <Heart className="w-3 h-3 text-destructive fill-destructive" />
          </div>
        </div>
      </div>
    );
  }
);
RecipePage.displayName = 'RecipePage';

export function CookbookView() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<RecipeWithMeta[]>([]);
  const [recipeImages, setRecipeImages] = useState<Record<string, string>>({});
  const [userName, setUserName] = useState<string>('My');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const bookRef = useRef<{ pageFlip: () => { flipNext: () => void; flipPrev: () => void; getCurrentPageIndex: () => number; getPageCount: () => number } }>(null);

  // Fetch user name
  useEffect(() => {
    const fetchUserName = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('user_extended')
        .select('name')
        .eq('user_id', user.id)
        .single();
      
      if (data?.name) {
        setUserName(data.name.split(' ')[0]); // Use first name
      }
    };
    
    fetchUserName();
  }, [user]);

  // Fetch favorites (same as FavoriteRecipesView)
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

  // Group and sort recipes by category
  const recipesByCategory = useMemo(() => {
    const grouped: Record<string, RecipeWithMeta[]> = {};
    
    MEAL_CATEGORIES.forEach(category => {
      const categoryRecipes = recipes.filter(r => r.meal_category === category);
      categoryRecipes.sort((a, b) => a.title.localeCompare(b.title));
      if (categoryRecipes.length > 0) {
        grouped[category] = categoryRecipes;
      }
    });
    
    // Uncategorized
    const uncategorized = recipes.filter(r => !r.meal_category || !MEAL_CATEGORIES.includes(r.meal_category as typeof MEAL_CATEGORIES[number]));
    if (uncategorized.length > 0) {
      uncategorized.sort((a, b) => a.title.localeCompare(b.title));
      grouped['other'] = uncategorized;
    }
    
    return grouped;
  }, [recipes]);

  // Build pages for the book
  const bookPages = useMemo(() => {
    const pages: React.ReactNode[] = [];
    let pageIndex = 0;
    
    // Cover page (right side of first spread)
    pages.push(
      <CoverPage key="cover" userName={userName} />
    );
    pageIndex++;

    // Add pages for each category
    const categories = Object.keys(recipesByCategory);
    
    categories.forEach((category) => {
      const categoryRecipes = recipesByCategory[category];
      
      // Blank page (left of category title)
      pages.push(
        <BlankPage key={`blank-${category}`} isLeft={pageIndex % 2 === 0} />
      );
      pageIndex++;

      // Category title page
      pages.push(
        <CategoryPage key={`cat-${category}`} category={category} isLeft={pageIndex % 2 === 0} />
      );
      pageIndex++;

      // Recipe pages (two recipes per spread - one left, one right)
      categoryRecipes.forEach((recipe, idx) => {
        const isLeft = pageIndex % 2 === 0;
        pages.push(
          <RecipePage 
            key={recipe.id} 
            recipe={recipe} 
            imageUrl={recipeImages[recipe.id]}
            isLeft={isLeft}
          />
        );
        pageIndex++;
      });

      // Add blank page if odd number of recipes to complete the spread
      if (categoryRecipes.length % 2 !== 0) {
        pages.push(
          <BlankPage key={`blank-after-${category}`} isLeft={pageIndex % 2 === 0} />
        );
        pageIndex++;
      }
    });

    // Back cover
    pages.push(
      <BackCover key="back-cover" />
    );

    return pages;
  }, [recipesByCategory, recipeImages, userName]);

  const handleFlip = useCallback((e: { data: number }) => {
    setCurrentPage(e.data);
  }, []);

  const handleInit = useCallback(() => {
    if (bookRef.current) {
      setTotalPages(bookRef.current.pageFlip().getPageCount());
    }
  }, []);

  const flipNext = () => {
    if (bookRef.current) {
      bookRef.current.pageFlip().flipNext();
    }
  };

  const flipPrev = () => {
    if (bookRef.current) {
      bookRef.current.pageFlip().flipPrev();
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
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <ChefHat className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Your cookbook is empty</h3>
        <p className="text-muted-foreground">
          Add some recipes to your favorites to see them in your cookbook!
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col items-center min-h-[calc(100vh-120px)]">
      {/* Book Container */}
      <div className="relative w-full max-w-4xl mx-auto">
        {/* Book shadow and base */}
        <div className="absolute inset-0 -bottom-4 bg-gradient-to-b from-transparent via-transparent to-black/10 rounded-lg pointer-events-none" />
        
        {/* The Flipbook */}
        <div className="relative z-10 flex justify-center">
          <HTMLFlipBook
            ref={bookRef}
            width={320}
            height={450}
            size="stretch"
            minWidth={280}
            maxWidth={400}
            minHeight={400}
            maxHeight={550}
            drawShadow={true}
            flippingTime={600}
            usePortrait={true}
            startZIndex={0}
            autoSize={true}
            maxShadowOpacity={0.5}
            showCover={true}
            mobileScrollSupport={true}
            clickEventForward={true}
            useMouseEvents={true}
            swipeDistance={30}
            showPageCorners={true}
            disableFlipByClick={false}
            onFlip={handleFlip}
            onInit={handleInit}
            className="cookbook-flipbook"
            style={{}}
            startPage={0}
          >
            {bookPages}
          </HTMLFlipBook>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          onClick={flipPrev}
          disabled={currentPage === 0}
          className="p-3 rounded-full bg-card border border-border hover:bg-primary/10 hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        
        <div className="text-sm text-muted-foreground font-medium px-4">
          Page {currentPage + 1} of {totalPages || bookPages.length}
        </div>
        
        <button
          onClick={flipNext}
          disabled={currentPage >= (totalPages || bookPages.length) - 1}
          className="p-3 rounded-full bg-card border border-border hover:bg-primary/10 hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md"
        >
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Instructions */}
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Click on page corners or use navigation buttons to turn pages
      </p>

      {/* Custom styles for the cookbook */}
      <style>{`
        .cookbook-flipbook {
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
        }
        
        .cookbook-flipbook .page-content {
          background: hsl(var(--card));
          box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.02);
        }
        
        .cookbook-flipbook .stf__parent {
          perspective: 2000px;
        }
        
        /* Paper texture effect */
        .page-content::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          opacity: 0.02;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
