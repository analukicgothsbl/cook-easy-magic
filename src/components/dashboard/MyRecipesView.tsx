import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Users, ChefHat, Loader2, BookOpen, Heart, ChevronLeft, ChevronRight, ImagePlus } from "lucide-react";
import { RecipeDetailModal } from "./RecipeDetailModal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Recipe } from "@/components/RecipeCard";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type MealCategoryFilter = "all" | "breakfast" | "lunch" | "dinner" | "dessert" | "snack";
type CuisineFilter =
  | "all"
  | "any_surprise_me"
  | "home_style_traditional"
  | "italian"
  | "mediterranean"
  | "mexican"
  | "asian"
  | "balkan"
  | "healthy_light"
  | "comfort_food";
type TimeSort = "none" | "asc" | "desc";

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

export function MyRecipesView() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<RecipeWithMeta[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [recipeImages, setRecipeImages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithMeta | null>(null);
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null);
  const [mealFilter, setMealFilter] = useState<MealCategoryFilter>("all");
  const [cuisineFilter, setCuisineFilter] = useState<CuisineFilter>("all");
  const [timeSort, setTimeSort] = useState<TimeSort>("none");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
  const RECIPES_PER_PAGE = 8;

  const filteredAndSortedRecipes = useMemo(() => {
    let result = [...recipes];

    // Apply meal category filter
    if (mealFilter !== "all") {
      result = result.filter((r) => r.meal_category === mealFilter);
    }

    // Apply cuisine filter
    if (cuisineFilter !== "all") {
      result = result.filter((r) => r.cuisine === cuisineFilter);
    }

    // Apply time sort
    if (timeSort === "asc") {
      result.sort((a, b) => (a.time_minutes || 999) - (b.time_minutes || 999));
    } else if (timeSort === "desc") {
      result.sort((a, b) => (b.time_minutes || 0) - (a.time_minutes || 0));
    } else {
      // Default: newest first
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [recipes, mealFilter, cuisineFilter, timeSort]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedRecipes.length / RECIPES_PER_PAGE);
  const paginatedRecipes = useMemo(() => {
    const startIndex = (currentPage - 1) * RECIPES_PER_PAGE;
    return filteredAndSortedRecipes.slice(startIndex, startIndex + RECIPES_PER_PAGE);
  }, [filteredAndSortedRecipes, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [mealFilter, cuisineFilter, timeSort]);

  const cuisineLabels: Record<CuisineFilter, string> = {
    all: "All Cuisines",
    any_surprise_me: "Any",
    home_style_traditional: "Traditional",
    italian: "Italian",
    mediterranean: "Mediterranean",
    mexican: "Mexican",
    asian: "Asian",
    balkan: "Balkan",
    healthy_light: "Healthy Light",
    comfort_food: "Comfort Food",
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch user role to check if admin
        const { data: userExtended } = await supabase
          .from("user_extended")
          .select("role")
          .eq("user_id", user.id)
          .single();

        setIsAdmin(userExtended?.role === "admin");

        // Fetch user's favorite recipe IDs
        const { data: favData } = await supabase.from("recipe_favorites").select("recipe_id").eq("user_id", user.id);

        if (favData) {
          setFavoriteIds(new Set(favData.map((f) => f.recipe_id)));
        }

        // Fetch recipes
        const { data, error } = await supabase
          .from("recipe_user")
          .select(
            `
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
          `,
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching recipes:", error);
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
              nutrition_estimate: recipe.nutrition_estimate as unknown as Recipe["nutrition_estimate"],
              created_at: item.created_at,
            };
          });

        setRecipes(formattedRecipes);

        // Fetch recipe images
        if (formattedRecipes.length > 0) {
          const recipeIds = formattedRecipes.map((r) => r.id);
          const { data: imageData } = await supabase
            .from("recipe_image")
            .select("recipe_id, image_url")
            .in("recipe_id", recipeIds);

          if (imageData) {
            const imageMap: Record<string, string> = {};
            imageData.forEach((img) => {
              if (img.image_url) {
                imageMap[img.recipe_id] = img.image_url;
              }
            });
            setRecipeImages(imageMap);
          }
        }
      } catch (error) {
        console.error("Error:", error);
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
          .from("recipe_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("recipe_id", recipeId);

        if (error) throw error;

        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(recipeId);
          return next;
        });
        toast.success("Removed from favorites");
      } else {
        // Add to favorites
        const { error } = await supabase.from("recipe_favorites").insert({ user_id: user.id, recipe_id: recipeId });

        if (error) {
          if (error.code === "23505") {
            toast.info("Already in favorites");
          } else {
            throw error;
          }
        } else {
          setFavoriteIds((prev) => new Set(prev).add(recipeId));
          toast.success("Added to favorites");
        }
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorite");
    } finally {
      setTogglingFavorite(null);
    }
  };

  const generateImage = async (e: React.MouseEvent, recipeId: string) => {
    e.stopPropagation();
    if (!user || generatingImageFor) return;

    setGeneratingImageFor(recipeId);
    const loadingToast = toast.loading("Generating image...");

    try {
      const { data, error } = await supabase.functions.invoke("generate-recipe-image", {
        body: { recipe_id: recipeId },
      });

      toast.dismiss(loadingToast);

      // ✅ FIX: check `ok`, not `success`
      if (error || !data?.ok) {
        console.error("Image generation error:", error || data?.error, "request_id:", data?.request_id);
        toast.error("Image generation failed");
        return;
      }

      setRecipeImages((prev) => ({
        ...prev,
        [recipeId]: data.image_url,
      }));

      toast.success("Image generated successfully");
    } catch (err) {
      toast.dismiss(loadingToast);
      console.error("Image generation exception:", err);
      toast.error("Image generation failed");
    } finally {
      setGeneratingImageFor(null);
    }
  };

  const formatIngredient = (ing: string | Ingredient): string => {
    if (typeof ing === "string") return ing;
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
        <p className="text-muted-foreground">Generate your first recipe to see it here!</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header with Subheading and Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <p className="text-muted-foreground">All recipes you've personally generated with CookMaster</p>

        {/* Filter Options */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Meal Category Filter */}
          <Select value={mealFilter} onValueChange={(value: MealCategoryFilter) => setMealFilter(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Meal Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Meals</SelectItem>
              <SelectItem value="breakfast">Breakfast</SelectItem>
              <SelectItem value="lunch">Lunch</SelectItem>
              <SelectItem value="dinner">Dinner</SelectItem>
              <SelectItem value="dessert">Dessert</SelectItem>
              <SelectItem value="snack">Snack</SelectItem>
            </SelectContent>
          </Select>

          {/* Cuisine Filter */}
          <Select value={cuisineFilter} onValueChange={(value: CuisineFilter) => setCuisineFilter(value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Cuisine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cuisines</SelectItem>
              <SelectItem value="any_surprise_me">Any</SelectItem>
              <SelectItem value="home_style_traditional">Traditional</SelectItem>
              <SelectItem value="italian">Italian</SelectItem>
              <SelectItem value="mediterranean">Mediterranean</SelectItem>
              <SelectItem value="mexican">Mexican</SelectItem>
              <SelectItem value="asian">Asian</SelectItem>
              <SelectItem value="balkan">Balkan</SelectItem>
              <SelectItem value="healthy_light">Healthy Light</SelectItem>
              <SelectItem value="comfort_food">Comfort Food</SelectItem>
            </SelectContent>
          </Select>

          {/* Cooking Time Sort */}
          <Select value={timeSort} onValueChange={(value: TimeSort) => setTimeSort(value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Cooking Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Newest First</SelectItem>
              <SelectItem value="asc">Time: Low to High</SelectItem>
              <SelectItem value="desc">Time: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {paginatedRecipes.map((recipe, index) => (
          <motion.div
            key={recipe.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="card-warm overflow-hidden cursor-pointer hover:border-primary/30 transition-colors relative group"
            onClick={() => setSelectedRecipe(recipe)}
          >
            {/* Square Recipe Image */}
            <div className="aspect-square bg-gradient-to-br from-primary/10 to-accent/20 flex items-center justify-center overflow-hidden relative">
              {recipeImages[recipe.id] ? (
                <img
                  src={recipeImages[recipe.id]}
                  alt={recipe.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <ChefHat className="w-12 h-12 text-primary/40" />
              )}
              {/* Admin Generate Image Button */}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  onClick={(e) => generateImage(e, recipe.id)}
                  disabled={generatingImageFor === recipe.id}
                >
                  {generatingImageFor === recipe.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImagePlus className="w-4 h-4" />
                  )}
                  <span className="ml-1 text-xs">
                    {generatingImageFor === recipe.id ? "Generating..." : "Generate OpenAI"}
                  </span>
                </Button>
              )}
            </div>

            {/* Content */}
            <div className="p-4 pb-3">
              <h3 className="font-bold text-foreground mb-2 line-clamp-1">{recipe.title}</h3>
              {recipe.description_short && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{recipe.description_short}</p>
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
                    {recipe.servings} servings
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                <button className="text-sm text-primary font-medium hover:underline">Show more...</button>
                {/* Favorite Heart */}
                <button
                  onClick={(e) => toggleFavorite(e, recipe.id)}
                  disabled={togglingFavorite === recipe.id}
                  className="p-1.5 rounded-full hover:bg-primary/10 transition-colors"
                >
                  <Heart
                    className={`w-4 h-4 transition-colors ${
                      favoriteIds.has(recipe.id)
                        ? "text-destructive fill-destructive"
                        : "text-muted-foreground hover:text-destructive"
                    } ${togglingFavorite === recipe.id ? "animate-pulse" : ""}`}
                  />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-border hover:bg-primary/10 hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
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
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-border hover:bg-primary/10 hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
        </div>
      )}

      {/* Full Recipe Modal */}
      <RecipeDetailModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
    </div>
  );
}
