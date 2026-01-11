import { useState, useRef, useEffect } from "react";
import { RecipeForm, type RecipeFormData, type UserDefaultOptions } from "@/components/RecipeForm";
import { RecipeCard, type Recipe } from "@/components/RecipeCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function GenerateRecipeView() {
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastFormData, setLastFormData] = useState<RecipeFormData | null>(null);
  const [userDefaults, setUserDefaults] = useState<UserDefaultOptions | undefined>(undefined);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);

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

  const handleFormSubmit = async (data: RecipeFormData) => {
    setLastFormData(data);
    setIsLoading(true);
    setErrorMsg("");
    setRecipe(null);
    setRecipeId(null);
    scrollToResult();

    try {
      const payload = {
        ...data,
        guest_id: null, // Logged in user
      };

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

        if (errorMessage.toLowerCase().includes("not enough credits")) {
          setErrorMsg("You don't have enough credits. Please add more credits.");
          return;
        }

        setErrorMsg("Something went wrong. Please try again.");
        return;
      }

      if (responseData?.error) {
        const errorMessage = responseData.error;

        if (errorMessage.toLowerCase().includes("not enough credits")) {
          setErrorMsg("You don't have enough credits. Please add more credits.");
          return;
        }

        setErrorMsg("Something went wrong. Please try again.");
        return;
      }

      if (responseData?.recipe) {
        setRecipeId(responseData.recipe_id);
        setRecipe(responseData.recipe);
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

  const handleRetry = () => {
    if (lastFormData) {
      handleFormSubmit(lastFormData);
    }
  };

  const handleGenerateAnother = () => {
    setRecipe(null);
    setRecipeId(null);
    setErrorMsg("");
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

      {(recipe || isLoading || errorMsg) && (
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
