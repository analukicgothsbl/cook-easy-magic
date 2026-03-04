import { useState, useRef, useEffect } from "react";
import { RecipeForm, type RecipeFormData, type UserDefaultOptions } from "@/components/RecipeForm";
import { RecipeCard, type Recipe } from "@/components/RecipeCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SimilarRecipe {
  id: string;
  title: string;
  title_similarity: number;
  ingredient_overlap: number;
}

interface DuplicateWarning {
  recipe: Recipe;
  similarRecipes: SimilarRecipe[];
  formData: RecipeFormData;
}

export function GenerateRecipeView() {
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastFormData, setLastFormData] = useState<RecipeFormData | null>(null);
  const [userDefaults, setUserDefaults] = useState<UserDefaultOptions | undefined>(undefined);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [isForceSaving, setIsForceSaving] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  // Fetch user's default options
  useEffect(() => {
    const fetchUserOptions = async () => {
      if (!user) {
        setIsLoadingDefaults(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_options")
          .select("time_available, difficulty, cuisine, servings, budget_level, kids_friendly, meal_category")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching user options:", error);
        } else if (data) {
          setUserDefaults({
            time_available: data.time_available,
            difficulty: data.difficulty,
            cuisine: data.cuisine,
            servings: data.servings,
            budget_level: data.budget_level,
            kids_friendly: data.kids_friendly,
            meal_category: data.meal_category,
          });
        }
      } catch (err) {
        console.error("Unexpected error fetching user options:", err);
      } finally {
        setIsLoadingDefaults(false);
      }
    };

    fetchUserOptions();
  }, [user]);

  const scrollToResult = () => {
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const triggerImageGeneration = async (createdRecipeId: string) => {
    setIsGeneratingImage(true);
    try {
      const { error } = await supabase.functions.invoke("generate-recipe-image", {
        body: { recipe_id: createdRecipeId },
      });
      if (error) console.error("[image] generation failed:", error);
    } catch (err) {
      console.error("[image] unexpected error:", err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleFormSubmit = async (data: RecipeFormData) => {
    setLastFormData(data);
    setIsLoading(true);
    setErrorMsg("");
    setRecipe(null);
    setRecipeId(null);
    setIsGeneratingImage(false);
    setDuplicateWarning(null);
    scrollToResult();

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setErrorMsg("Your session has expired. Please log in again.");
        return;
      }

      const payload = { ...data, guest_id: null };

      const { data: responseData, error } = await supabase.functions.invoke("generate-recipe", {
        body: payload,
      });

      if (error) {
        let errorMessage = "";
        if (error.context && typeof error.context === "object") {
          try {
            const responseBody = await (error.context as Response).json?.();
            errorMessage = responseBody?.error || "";
          } catch {
            errorMessage = error.message || "";
          }
        } else {
          errorMessage = error.message || "";
        }

        const normalizedError = errorMessage.toLowerCase();
        if (normalizedError.includes("not enough credits") || normalizedError.includes("insufficient_credits")) {
          setErrorMsg("You don't have enough credits. Please add more credits.");
          return;
        }
        if (normalizedError.includes("session") || normalizedError.includes("authentication")) {
          setErrorMsg("Your session has expired. Please log in again.");
          return;
        }
        setErrorMsg("Something went wrong. Please try again.");
        return;
      }

      if (responseData?.error) {
        const errorMessage = responseData.error;
        const normalizedError = errorMessage.toLowerCase();
        if (normalizedError.includes("not enough credits") || normalizedError.includes("insufficient_credits")) {
          setErrorMsg("You don't have enough credits. Please add more credits.");
          return;
        }
        setErrorMsg("Something went wrong. Please try again.");
        return;
      }

      // Check for duplicate warning
      if (responseData?.duplicate_warning) {
        setDuplicateWarning({
          recipe: responseData.recipe,
          similarRecipes: responseData.similar_recipes || [],
          formData: data,
        });
        return;
      }

      // Success
      if (responseData?.recipe) {
        const createdRecipeId = responseData.recipe_id;
        setRecipeId(createdRecipeId);
        setRecipe(responseData.recipe);
        if (createdRecipeId) triggerImageGeneration(createdRecipeId);
      } else {
        setErrorMsg("Failed to generate recipe. Please try again.");
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceSave = async () => {
    if (!duplicateWarning) return;
    setIsForceSaving(true);
    setDuplicateWarning(null);
    setIsLoading(true);

    try {
      const payload = { ...duplicateWarning.formData, guest_id: null, force_save: true };

      const { data: responseData, error } = await supabase.functions.invoke("generate-recipe", {
        body: payload,
      });

      if (error || responseData?.error) {
        setErrorMsg("Something went wrong saving the recipe. Please try again.");
        return;
      }

      if (responseData?.recipe) {
        const createdRecipeId = responseData.recipe_id;
        setRecipeId(createdRecipeId);
        setRecipe(responseData.recipe);
        if (createdRecipeId) triggerImageGeneration(createdRecipeId);
      }
    } catch (err) {
      console.error("Force save error:", err);
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
      setIsForceSaving(false);
    }
  };

  const handleDiscardDuplicate = () => {
    setDuplicateWarning(null);
  };

  const handleRetry = () => {
    if (lastFormData) handleFormSubmit(lastFormData);
  };

  const handleGenerateAnother = () => {
    setRecipe(null);
    setRecipeId(null);
    setErrorMsg("");
    setIsGeneratingImage(false);
    setDuplicateWarning(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isLoadingDefaults) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-4xl mx-auto">
        <RecipeForm
          onSubmit={handleFormSubmit}
          isLoading={isLoading}
          isRegistered={true}
          isGuestBlocked={false}
          defaultValues={userDefaults}
        />
      </div>

      {/* Duplicate Warning */}
      {duplicateWarning && (
        <div ref={resultRef} className="max-w-4xl mx-auto">
          <div className="card-warm p-6 border-2 border-amber-300 dark:border-amber-600">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-1">Similar Recipe Found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  The generated recipe "<span className="font-medium text-foreground">{duplicateWarning.recipe.title}</span>" is similar to recipes you already have:
                </p>

                <div className="space-y-2 mb-5">
                  {duplicateWarning.similarRecipes.map((sr) => (
                    <div key={sr.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{sr.title}</p>
                        <div className="flex gap-3 mt-1">
                          {sr.title_similarity > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Title match: <span className="font-medium text-amber-600 dark:text-amber-400">{sr.title_similarity}%</span>
                            </span>
                          )}
                          {sr.ingredient_overlap > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Ingredients overlap: <span className="font-medium text-amber-600 dark:text-amber-400">{sr.ingredient_overlap}%</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleForceSave}
                    disabled={isForceSaving}
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isForceSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Save Anyway
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDiscardDuplicate}
                    className="rounded-full"
                  >
                    Discard & Try Again
                  </Button>
                </div>
              </div>
              <button
                onClick={handleDiscardDuplicate}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {(recipe || isLoading || errorMsg) && !duplicateWarning && (
        <div ref={resultRef} className="max-w-4xl mx-auto">
          <RecipeCard
            recipe={recipe || { title: "", ingredients: [] }}
            recipeId={recipeId || undefined}
            onGenerateAnother={handleGenerateAnother}
            isLoading={isLoading}
            errorMsg={errorMsg}
            onRetry={handleRetry}
            isLoggedIn={true}
            isGuestBlocked={false}
          />
        </div>
      )}
    </div>
  );
}
