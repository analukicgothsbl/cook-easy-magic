import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Users,
  RefreshCw,
  Heart,
  Lock,
  Lightbulb,
  ChefHat,
  Flame,
  UserPlus,
  LogIn,
  Check,
  Loader2,
  ImageIcon,
  CreditCard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import foodPasta from "@/assets/food-pasta.jpg";

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface NutritionEstimate {
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
}

export interface Recipe {
  id?: string;
  title: string;
  description_short?: string;
  description_long?: string;
  mealType?: string;
  meal_category?: string;
  time?: string;
  time_minutes?: number;
  cuisine?: string;
  servings?: number;
  difficulty?: string;
  budget_level?: string;
  kids_friendly?: boolean;
  ingredients: (string | Ingredient)[];
  steps?: string[];
  instructions?: string[];
  tip?: string;
  tips?: string;
  nutrition_estimate?: NutritionEstimate;
}

interface RecipeCardProps {
  recipe: Recipe;
  recipeId?: string;
  onGenerateAnother: () => void;
  isLoading?: boolean;
  errorMsg?: string;
  onRetry?: () => void;
  isLoggedIn?: boolean;
  isGuestBlocked?: boolean;
}

// Loading animation messages
const loadingMessages = [
  "Finding the perfect recipe...",
  "Mixing ingredients...",
  "Preheating the oven...",
  "Adding a pinch of creativity...",
  "Taste testing...",
  "Almost ready to serve...",
];

// Skeleton loader component with animation
const RecipeSkeleton = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="section-padding bg-background">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-warm overflow-hidden"
        >
          {/* Animated image placeholder */}
          <div className="h-80 sm:h-96 bg-gradient-to-br from-primary/20 via-accent to-secondary/30 relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                <ChefHat className="w-12 h-12 text-primary" />
              </motion.div>
              <motion.p
                key={messageIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 text-foreground font-medium text-lg"
              >
                {loadingMessages[messageIndex]}
              </motion.p>
            </div>
          </div>
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-3">
              <motion.div
                className="h-8 bg-muted rounded w-3/4"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="h-4 bg-muted rounded w-1/2"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
              />
              <div className="flex gap-3">
                <motion.div
                  className="h-6 bg-muted rounded-full w-20"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                />
                <motion.div
                  className="h-6 bg-muted rounded w-24"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                />
                <motion.div
                  className="h-6 bg-muted rounded w-24"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                />
              </div>
            </div>
            <div className="space-y-3">
              <motion.div
                className="h-6 bg-muted rounded w-32"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="h-5 bg-muted rounded w-full"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <motion.div
                className="h-6 bg-muted rounded w-32"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <motion.div
                    className="h-8 w-8 bg-muted rounded-full flex-shrink-0"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                  />
                  <motion.div
                    className="h-5 bg-muted rounded flex-1"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + 0.1 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export const RecipeCard = ({
  recipe,
  recipeId,
  onGenerateAnother,
  isLoading = false,
  errorMsg = "",
  onRetry,
  isLoggedIn = false,
  isGuestBlocked = false,
}: RecipeCardProps) => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [recipeImageUrl, setRecipeImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  // Poll for recipe image when logged in and recipe is displayed
  useEffect(() => {
    if (!recipeId || !isLoggedIn || isLoading) {
      setRecipeImageUrl(null);
      return;
    }

    let isMounted = true;
    let pollCount = 0;
    const maxPolls = 60; // Poll for up to 60 seconds
    const pollInterval = 1000; // Poll every second
    let intervalId: NodeJS.Timeout | null = null;

    const fetchImage = async () => {
      try {
        const { data, error } = await supabase
          .from("recipe_image")
          .select("image_url")
          .eq("recipe_id", recipeId)
          .maybeSingle();

        if (error) {
          console.error("Error fetching recipe image:", error);
          return false;
        }

        if (data?.image_url && isMounted) {
          console.log("[RecipeCard] Image found for recipe:", recipeId);
          setRecipeImageUrl(data.image_url);
          setIsLoadingImage(false);
          return true; // Image found
        }
        return false; // Keep polling
      } catch (err) {
        console.error("Error fetching recipe image:", err);
        return false;
      }
    };

    const pollForImage = async () => {
      setIsLoadingImage(true);
      setRecipeImageUrl(null);

      // First immediate check
      const found = await fetchImage();
      if (found) return;

      // Start polling
      intervalId = setInterval(async () => {
        pollCount++;
        const found = await fetchImage();

        if (found || pollCount >= maxPolls) {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          if (!found && isMounted) {
            console.log("[RecipeCard] Polling stopped - no image found after", pollCount, "polls");
            setIsLoadingImage(false);
          }
        }
      }, pollInterval);
    };

    pollForImage();

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [recipeId, isLoggedIn, isLoading]);

  const handleSaveRecipe = async () => {
    if (!isLoggedIn) {
      setShowSavePrompt(true);
      return;
    }

    if (!recipeId) {
      toast.error("Recipe ID not found");
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to save recipes");
        return;
      }

      const { error } = await supabase.from("recipe_favorites").insert({
        user_id: user.id,
        recipe_id: recipeId,
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("Recipe already saved!");
          setIsSaved(true);
        } else {
          throw error;
        }
      } else {
        setIsSaved(true);
        toast.success("Recipe saved to your cookbook!");
      }
    } catch (err) {
      console.error("Error saving recipe:", err);
      toast.error("Failed to save recipe");
    } finally {
      setIsSaving(false);
    }
  };

  // Show skeleton while loading
  if (isLoading) {
    return <RecipeSkeleton />;
  }

  // Show guest limit reached CTA
  if (isGuestBlocked) {
    return (
      <section className="section-padding bg-background">
        <div className="container-narrow">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="card-warm p-8 text-center"
          >
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">👋</span>
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3 font-serif">You've used your free recipe</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create a free account to unlock more recipes, daily credits, and saved favorites.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <motion.button
                onClick={() => navigate("/auth")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary flex items-center justify-center gap-2 px-6"
              >
                <UserPlus className="w-4 h-4" />
                Create free account
              </motion.button>
              <motion.button
                onClick={() => navigate("/auth")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary flex items-center justify-center gap-2 px-6"
              >
                <LogIn className="w-4 h-4" />
                Login
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>
    );
  }

  // Show error state
  const isCreditsError = errorMsg.toLowerCase().includes("enough credits");

  if (errorMsg) {
    return (
      <section className="section-padding bg-background">
        <div className="container-narrow">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="card-warm p-8 text-center"
          >
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">{isCreditsError ? "💳" : "😕"}</span>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              {isCreditsError ? "Out of Credits" : "Oops! Something went wrong"}
            </h3>
            <p className="text-muted-foreground mb-6">{errorMsg}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {isCreditsError ? (
                <motion.button
                  onClick={() => navigate("/dashboard", { state: { view: "settings", settingsTab: "credits" } })}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Buy credits
                </motion.button>
              ) : (
                onRetry && (
                  <motion.button
                    onClick={onRetry}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try again
                  </motion.button>
                )
              )}
            </div>
          </motion.div>
        </div>
      </section>
    );
  }

  // Parse data from either old or new format
  const displayMealType = recipe.mealType || recipe.meal_category || "Recipe";
  const displayTime = recipe.time || (recipe.time_minutes ? `${recipe.time_minutes} min` : "N/A");
  const displayServings = recipe.servings || 2;
  const displayCuisine = recipe.cuisine === "any_surprise_me" ? "Surprise" : recipe.cuisine || "Mixed";
  const displayTip = recipe.tip || recipe.tips;
  const displayInstructions = recipe.steps || recipe.instructions || [];

  // Handle ingredients - can be array of strings or objects
  const formattedIngredients = recipe.ingredients.map((ing) => {
    if (typeof ing === "string") {
      return ing;
    }
    return `${ing.quantity} ${ing.unit} ${ing.name}`.trim();
  });

  return (
    <section className="section-padding bg-background">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="card-warm overflow-hidden"
        >
          {/* Recipe Image */}
          <div className="relative h-80 sm:h-96 overflow-hidden">
            {isLoggedIn ? (
              // Logged in user - show real image or loading state
              recipeImageUrl ? (
                <img src={recipeImageUrl} alt={recipe.title} className="w-full h-full object-cover" />
              ) : isLoadingImage ? (
                // Image is being generated
                <div className="w-full h-full bg-gradient-to-br from-primary/20 via-accent to-secondary/30 flex items-center justify-center">
                  <div className="text-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="mb-3"
                    >
                      <ImageIcon className="w-10 h-10 text-primary" />
                    </motion.div>
                    <p className="text-sm font-medium text-foreground">Generating image...</p>
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mt-2 text-muted-foreground" />
                  </div>
                </div>
              ) : (
                // No image available (fallback)
                <div className="w-full h-full bg-gradient-to-br from-primary/10 to-secondary/20 flex items-center justify-center">
                  <ChefHat className="w-16 h-16 text-primary/40" />
                </div>
              )
            ) : (
              // Guest user - show locked state
              <>
                <img src={foodPasta} alt={recipe.title} className="w-full h-full object-cover blur-sm scale-105" />
                <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
                  <div className="text-center text-primary-foreground">
                    <Lock className="w-8 h-8 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-medium opacity-90">Sign up to see recipe images</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Recipe Content */}
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="mb-6">
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground font-serif mb-2">{recipe.title}</h3>
              {recipe.description_short && <p className="text-muted-foreground mb-3">{recipe.description_short}</p>}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full font-medium capitalize">
                  {displayMealType}
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {displayTime}
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {displayServings} servings
                </span>
                {recipe.difficulty && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground capitalize">
                    <ChefHat className="w-4 h-4" />
                    {recipe.difficulty}
                  </span>
                )}
                <span className="text-muted-foreground capitalize">{displayCuisine}</span>
              </div>
            </div>

            {/* Nutrition (optional) */}
            {recipe.nutrition_estimate && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-3 mb-6 p-3 bg-secondary/50 rounded-xl"
              >
                <span className="inline-flex items-center gap-1 text-sm">
                  <Flame className="w-4 h-4 text-primary" />
                  <strong>{recipe.nutrition_estimate.calories}</strong> kcal
                </span>
                <span className="text-sm text-muted-foreground">Protein: {recipe.nutrition_estimate.protein}</span>
                <span className="text-sm text-muted-foreground">Carbs: {recipe.nutrition_estimate.carbs}</span>
                <span className="text-sm text-muted-foreground">Fat: {recipe.nutrition_estimate.fat}</span>
              </motion.div>
            )}

            {/* Ingredients */}
            <div className="mb-6">
              <h4 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm">
                  🥘
                </span>
                Ingredients
              </h4>
              <ul className="grid gap-2 sm:grid-cols-2">
                {formattedIngredients.map((ingredient, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-start gap-2 text-foreground"
                  >
                    <span className="text-primary mt-0.5">•</span>
                    {ingredient}
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Steps */}
            <div className="mb-6">
              <h4 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm">
                  📝
                </span>
                Instructions
              </h4>
              <ol className="space-y-4">
                {displayInstructions.map((step, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
                    className="flex gap-4"
                  >
                    <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </span>
                    <p className="text-foreground pt-1">{step}</p>
                  </motion.li>
                ))}
              </ol>
            </div>

            {/* Tip */}
            {displayTip && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="p-4 bg-accent rounded-xl border border-primary/20 mb-6"
              >
                <div className="flex gap-3">
                  <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground text-sm mb-1">Pro tip</p>
                    <p className="text-muted-foreground text-sm">{displayTip}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Save Prompt for Guests */}
            {showSavePrompt && !isLoggedIn && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-accent rounded-xl border border-primary/20 mb-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex gap-3 items-start">
                    <Heart className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground text-sm mb-1">
                        Register account, save recipe and make your cook book
                      </p>
                      <p className="text-muted-foreground text-sm">Create a free account to save unlimited recipes!</p>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => navigate("/auth")}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary text-sm px-4 py-2 whitespace-nowrap"
                  >
                    Create account
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <motion.button
                onClick={onGenerateAnother}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Generate another recipe
              </motion.button>
              <motion.button
                onClick={handleSaveRecipe}
                disabled={isSaving || isSaved}
                whileHover={{ scale: isSaved ? 1 : 1.02 }}
                whileTap={{ scale: isSaved ? 1 : 0.98 }}
                className={`flex-1 flex items-center justify-center gap-2 ${isSaved ? "btn-primary" : "btn-outline"}`}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : isSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4" />
                    Save recipe
                    {!isLoggedIn && <Lock className="w-3 h-3 opacity-60" />}
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
