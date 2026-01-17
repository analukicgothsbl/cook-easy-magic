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
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

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

  // Non-blocking image generation after recipe is created
  const triggerImageGeneration = async (createdRecipeId: string) => {
    setIsGeneratingImage(true);
    try {
      console.log("[image] triggering generation for recipe:", createdRecipeId);
      
      const { error } = await supabase.functions.invoke("generate-recipe-image", {
        body: { recipe_id: createdRecipeId },
      });

      if (error) {
        console.error("[image] generation failed:", error);
        // Non-fatal - recipe is still visible
      } else {
        console.log("[image] generation triggered successfully");
      }
    } catch (err) {
      console.error("[image] unexpected error:", err);
      // Non-fatal - recipe is still visible
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
    scrollToResult();

    try {
      const payload = {
        ...data,
        guest_id: null, // Logged in user
      };

      const { data: responseData, error } = await supabase.functions.invoke("generate-recipe", {
        body: payload,
      });

      console.log("[generate-recipe] response:", { responseData, error });

      // Extract error message from response or error object
      let errorMessage = "";
      
      if (error) {
        console.log("[generate-recipe] error details:", error);
        
        // Try to get error from response context (FunctionsHttpError)
        if (error.context && typeof error.context === "object") {
          try {
            const response = error.context as Response;
            if (response.json) {
              // Clone the response first since body can only be read once
              const responseBody = await response.clone().json();
              console.log("[generate-recipe] error response body:", responseBody);
              errorMessage = responseBody?.error || "";
            }
          } catch (e) {
            console.log("[generate-recipe] could not parse error response:", e);
          }
        }
        
        if (!errorMessage) {
          errorMessage = error.message || "";
        }
      }

      // Check response data for error as well
      if (responseData?.error) {
        errorMessage = responseData.error;
      }

      // Handle specific error cases
      if (errorMessage) {
        console.log("[generate-recipe] extracted error message:", errorMessage);
        
        if (errorMessage.toLowerCase().includes("not enough credits") || 
            errorMessage.toLowerCase().includes("credit balance") ||
            errorMessage.toLowerCase().includes("verify credit")) {
          setErrorMsg("You don't have enough credits. Please add more credits.");
          return;
        }

        setErrorMsg("Something went wrong. Please try again.");
        return;
      }

      // Check for error without parsed message
      if (error && !responseData?.recipe) {
        console.log("[generate-recipe] error without message, defaulting");
        setErrorMsg("Something went wrong. Please try again.");
        return;
      }

      // Success - set recipe data immediately
      if (responseData?.recipe) {
        const createdRecipeId = responseData.recipe_id;
        setRecipeId(createdRecipeId);
        setRecipe(responseData.recipe);
        
        // Trigger image generation after recipe is displayed (non-blocking)
        if (createdRecipeId) {
          triggerImageGeneration(createdRecipeId);
        }
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
    setIsGeneratingImage(false);
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
