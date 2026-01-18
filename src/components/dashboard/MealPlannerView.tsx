import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  Users,
  ChefHat,
  Loader2,
  Calendar,
  Trash2,
  Search,
  Eye,
  Sparkles,
  CreditCard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RecipeDetailModal } from "./RecipeDetailModal";
import type { Recipe } from "@/components/RecipeCard";
import type { Json } from "@/integrations/supabase/types";

// Options for meal plan form
const cuisineOptions = [
  { id: "any_surprise_me", label: "Any – Surprise me" },
  { id: "home_style_traditional", label: "Home-style / Traditional" },
  { id: "italian", label: "Italian" },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "mexican", label: "Mexican" },
  { id: "asian", label: "Asian" },
  { id: "balkan", label: "Balkan" },
  { id: "healthy_light", label: "Healthy – Light" },
  { id: "comfort_food", label: "Comfort food" },
];

const difficultyOptions = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

const budgetOptions = [
  { id: "cheap", label: "Cheap" },
  { id: "normal", label: "Normal" },
  { id: "doesnt_matter", label: "Doesn't matter" },
];

const kidsFriendlyOptions = [
  { id: "yes", label: "Yes", value: true },
  { id: "no", label: "No", value: false },
];

interface UserOptions {
  time_available?: string | null;
  difficulty?: string | null;
  cuisine?: string | null;
  servings?: number | null;
  budget_level?: string | null;
  kids_friendly?: boolean | null;
}

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

interface RecipeWithMeta extends Recipe {
  id: string;
  created_at: string;
  image_url?: string;
}

interface MealPlanEntry {
  id: string;
  plan_date: string;
  meal_slot: string;
  recipe_id: string | null;
  custom_text?: string | null;
  recipe?: RecipeWithMeta;
}

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

const MEAL_SLOTS = [
  { id: "breakfast", label: "Breakfast", icon: "🌅" },
  { id: "snack_morning", label: "Snack 1", icon: "🍎" },
  { id: "lunch", label: "Lunch", icon: "☀️" },
  { id: "snack_afternoon", label: "Snack 2", icon: "🍪" },
  { id: "dinner", label: "Dinner", icon: "🌙" },
] as const;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MealPlannerView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([]);
  const [favorites, setFavorites] = useState<RecipeWithMeta[]>([]);
  const [recipeImages, setRecipeImages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addMealModal, setAddMealModal] = useState<{ date: Date; slot: string } | null>(null);
  const [viewRecipeModal, setViewRecipeModal] = useState<RecipeWithMeta | null>(null);

  // Modal filter states
  const [modalMealFilter, setModalMealFilter] = useState<MealCategoryFilter>("all");
  const [modalCuisineFilter, setModalCuisineFilter] = useState<CuisineFilter>("all");
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [customMealText, setCustomMealText] = useState("");

  // Full-day meal plan form states
  const [showMealPlanForm, setShowMealPlanForm] = useState(false);
  const [userOptions, setUserOptions] = useState<UserOptions | null>(null);
  const [mealPlanFormData, setMealPlanFormData] = useState({
    time_available: "",
    cuisine: "",
    difficulty: "",
    servings: 2,
    budget_level: "",
    kids_friendly: null as boolean | null,
  });
  const [isLoadingUserOptions, setIsLoadingUserOptions] = useState(false);
  const [isGeneratingMealPlan, setIsGeneratingMealPlan] = useState(false);
  const [showCreditsError, setShowCreditsError] = useState(false);

  // Generate week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Reset modal filters when modal closes
  useEffect(() => {
    if (!addMealModal) {
      setModalMealFilter("all");
      setModalCuisineFilter("all");
      setModalSearchQuery("");
      setCustomMealText("");
    }
  }, [addMealModal]);

  // Reset credits error when selectedDay modal closes
  useEffect(() => {
    if (!selectedDay) {
      setShowCreditsError(false);
      setShowMealPlanForm(false);
    }
  }, [selectedDay]);

  // Fetch user options when meal plan form is shown
  useEffect(() => {
    const fetchUserOptions = async () => {
      if (!showMealPlanForm || !user) return;

      setIsLoadingUserOptions(true);
      try {
        const { data, error } = await supabase.from("user_options").select("*").eq("user_id", user.id).maybeSingle();

        if (error) {
          console.error("Error fetching user options:", error);
        } else if (data) {
          setUserOptions(data);
          // Pre-fill form with user options
          setMealPlanFormData({
            time_available: data.time_available || "",
            cuisine: data.cuisine || "",
            difficulty: data.difficulty || "",
            servings: data.servings || 2,
            budget_level: data.budget_level || "",
            kids_friendly: data.kids_friendly ?? null,
          });
        } else {
          // No user options, reset form
          setUserOptions(null);
          setMealPlanFormData({
            time_available: "",
            cuisine: "",
            difficulty: "",
            servings: 2,
            budget_level: "",
            kids_friendly: null,
          });
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsLoadingUserOptions(false);
      }
    };

    fetchUserOptions();
  }, [showMealPlanForm, user]);

  // Reset form when closing
  useEffect(() => {
    if (!selectedDay) {
      setShowMealPlanForm(false);
    }
  }, [selectedDay]);

  // Check if meal plan form is valid
  const isMealPlanFormValid =
    mealPlanFormData.time_available &&
    mealPlanFormData.cuisine &&
    mealPlanFormData.difficulty &&
    mealPlanFormData.servings > 0 &&
    mealPlanFormData.budget_level &&
    mealPlanFormData.kids_friendly !== null;

  // Filter favorites for modal
  const filteredFavorites = useMemo(() => {
    let result = [...favorites];

    // Apply meal category filter
    if (modalMealFilter !== "all") {
      result = result.filter((r) => r.meal_category === modalMealFilter);
    }

    // Apply cuisine filter
    if (modalCuisineFilter !== "all") {
      result = result.filter((r) => r.cuisine === modalCuisineFilter);
    }

    // Apply search query (case-insensitive search in title and ingredients)
    if (modalSearchQuery.trim()) {
      const query = modalSearchQuery.toLowerCase().trim();
      result = result.filter((recipe) => {
        // Search in title
        if (recipe.title.toLowerCase().includes(query)) {
          return true;
        }
        // Search in ingredients
        if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
          return recipe.ingredients.some((ing) => {
            if (typeof ing === "string") {
              return ing.toLowerCase().includes(query);
            }
            // If ingredient is an object with name property
            if (ing && typeof ing === "object" && "name" in ing) {
              return (ing as Ingredient).name.toLowerCase().includes(query);
            }
            return false;
          });
        }
        return false;
      });
    }

    return result;
  }, [favorites, modalMealFilter, modalCuisineFilter, modalSearchQuery]);

  // Fetch meal plan and favorites
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsLoading(true);

      try {
        // Fetch meal plan for current week
        const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
        const { data: mealPlanData, error: mealPlanError } = await supabase
          .from("meal_plan")
          .select("id, plan_date, meal_slot, recipe_id, custom_text")
          .eq("user_id", user.id)
          .gte("plan_date", format(currentWeekStart, "yyyy-MM-dd"))
          .lte("plan_date", format(weekEnd, "yyyy-MM-dd"));

        if (mealPlanError) {
          console.error("Error fetching meal plan:", mealPlanError);
        }

        // Fetch favorites
        const { data: favoritesData, error: favoritesError } = await supabase
          .from("recipe_favorites")
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

        if (favoritesError) {
          console.error("Error fetching favorites:", favoritesError);
        }

        // Format favorites
        const formattedFavorites: RecipeWithMeta[] = (favoritesData || [])
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

        setFavorites(formattedFavorites);

        // Create recipe lookup map
        const recipeMap = new Map(formattedFavorites.map((r) => [r.id, r]));

        // Format meal plan with recipe details
        const formattedMealPlan: MealPlanEntry[] = (mealPlanData || []).map((entry) => ({
          ...entry,
          recipe: recipeMap.get(entry.recipe_id),
        }));

        setMealPlan(formattedMealPlan);

        // Fetch recipe images
        const allRecipeIds = [
          ...new Set([
            ...formattedFavorites.map((r) => r.id),
            ...(mealPlanData || []).map((m) => m.recipe_id).filter((id): id is string => id !== null),
          ]),
        ].filter(Boolean);

        if (allRecipeIds.length > 0) {
          const { data: imageData } = await supabase
            .from("recipe_image")
            .select("recipe_id, image_url")
            .in("recipe_id", allRecipeIds);

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
  }, [user, currentWeekStart]);

  // Get meal for a specific date and slot
  const getMealForSlot = (date: Date, slotId: string): MealPlanEntry | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return mealPlan.find((m) => m.plan_date === dateStr && m.meal_slot === slotId);
  };

  // Add meal to plan
  const handleAddMeal = async (recipeId: string) => {
    if (!user || !addMealModal) return;

    const dateStr = format(addMealModal.date, "yyyy-MM-dd");

    try {
      const { data, error } = await supabase
        .from("meal_plan")
        .insert({
          user_id: user.id,
          plan_date: dateStr,
          meal_slot: addMealModal.slot,
          recipe_id: recipeId,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("A meal is already planned for this slot");
        } else {
          toast.error("Failed to add meal");
          console.error("Error adding meal:", error);
        }
        return;
      }

      const recipe = favorites.find((f) => f.id === recipeId);
      setMealPlan((prev) => [...prev, { ...data, recipe }]);
      setAddMealModal(null);
      toast.success("Meal added to plan!");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to add meal");
    }
  };

  // Add custom meal to plan
  const handleAddCustomMeal = async () => {
    if (!user || !addMealModal || !customMealText.trim()) return;

    const dateStr = format(addMealModal.date, "yyyy-MM-dd");

    try {
      const { data, error } = await supabase
        .from("meal_plan")
        .insert({
          user_id: user.id,
          plan_date: dateStr,
          meal_slot: addMealModal.slot,
          custom_text: customMealText.trim(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("A meal is already planned for this slot");
        } else {
          toast.error("Failed to add custom meal");
          console.error("Error adding custom meal:", error);
        }
        return;
      }

      setMealPlan((prev) => [...prev, data]);
      setAddMealModal(null);
      toast.success("Custom meal added to plan!");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to add custom meal");
    }
  };

  // Remove meal from plan
  const handleRemoveMeal = async (mealId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("meal_plan").delete().eq("id", mealId).eq("user_id", user.id);

      if (error) {
        toast.error("Failed to remove meal");
        console.error("Error removing meal:", error);
        return;
      }

      setMealPlan((prev) => prev.filter((m) => m.id !== mealId));
      toast.success("Meal removed");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to remove meal");
    }
  };

  // Navigate weeks
  const goToPreviousWeek = () => setCurrentWeekStart((prev) => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart((prev) => addWeeks(prev, 1));
  const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <p className="text-muted-foreground mb-6">Plan your meals for the week using your favorite recipes</p>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToCurrentWeek} className="ml-2">
            <Calendar className="w-4 h-4 mr-2" />
            Today
          </Button>
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
        </h2>
      </div>

      {/* Week Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day, dayIndex) => {
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const dayMeals = mealPlan.filter((m) => m.plan_date === format(day, "yyyy-MM-dd"));

          return (
            <motion.div
              key={day.toISOString()}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: dayIndex * 0.05 }}
              className={`card-warm p-3 cursor-pointer transition-all ${
                isToday ? "ring-2 ring-primary" : ""
              } ${isSelected ? "bg-primary/5" : ""}`}
              onClick={() => setSelectedDay(isSelected ? null : day)}
            >
              {/* Day Header */}
              <div className="text-center mb-3">
                <p className="text-xs text-muted-foreground uppercase">{DAY_NAMES[dayIndex]}</p>
                <p className={`text-lg font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
                  {format(day, "d")}
                </p>
              </div>

              {/* Compact Meal Slots */}
              <div className="space-y-1">
                {MEAL_SLOTS.map((slot) => {
                  const meal = getMealForSlot(day, slot.id);
                  return (
                    <div
                      key={slot.id}
                      className={`text-xs p-1.5 rounded transition-colors ${
                        meal ? "bg-primary/10 text-foreground" : "bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span>{slot.icon}</span>
                        <span className="truncate flex-1">
                          {meal?.recipe?.title || meal?.custom_text || slot.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Meal count badge */}
              {dayMeals.length > 0 && (
                <div className="mt-2 text-center">
                  <span className="text-xs text-primary font-medium">
                    {dayMeals.length} meal{dayMeals.length !== 1 ? "s" : ""} planned
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Expanded Day View */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 overflow-hidden"
          >
            <div className="card-warm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-foreground">{format(selectedDay, "EEEE, MMMM d")}</h3>
                <div className="flex items-center gap-2">
                  <Button
                    className="rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                    onClick={() => setShowMealPlanForm(!showMealPlanForm)}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Suggest Full-Day Meal Plan
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedDay(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Out of Credits Error Card */}
              <AnimatePresence>
                {showCreditsError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6"
                  >
                    <div className="bg-secondary/50 rounded-xl p-8 border border-border text-center">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">Out of Credits</h3>
                      <p className="text-muted-foreground mb-6">
                        You don't have enough credits. Please add more credits.
                      </p>
                      <motion.button
                        onClick={() => {
                          setSelectedDay(null);
                          navigate("/dashboard", { state: { view: "settings", settingsTab: "credits" } });
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-medium hover:bg-primary/90 transition-colors"
                      >
                        <CreditCard className="w-4 h-4" />
                        Buy credits
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Full-Day Meal Plan Options Form */}
              <AnimatePresence>
                {showMealPlanForm && !showCreditsError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-6"
                  >
                    <div className="max-w-4xl mx-auto bg-secondary/50 rounded-xl p-6 border border-border">
                      {isLoadingUserOptions ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="text-center mb-4">
                            <h4 className="text-lg font-semibold text-foreground">Customize Your Meal Plan</h4>
                            <p className="text-sm text-muted-foreground">
                              Set your preferences for AI-generated meal suggestions
                            </p>
                          </div>

                          {/* Time Available */}
                          <div>
                            <label className="block text-sm font-semibold text-foreground mb-3">
                              How much time do you have? <span className="text-primary">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              <motion.button
                                type="button"
                                onClick={() => setMealPlanFormData((prev) => ({ ...prev, time_available: "minimum" }))}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all duration-200 ${
                                  mealPlanFormData.time_available === "minimum"
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : "bg-card text-foreground border-2 border-border hover:border-primary/40"
                                }`}
                              >
                                <Clock className="w-4 h-4" />
                                Minimum time
                              </motion.button>
                              <motion.button
                                type="button"
                                onClick={() => setMealPlanFormData((prev) => ({ ...prev, time_available: "enough" }))}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all duration-200 ${
                                  mealPlanFormData.time_available === "enough"
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : "bg-card text-foreground border-2 border-border hover:border-primary/40"
                                }`}
                              >
                                <Clock className="w-4 h-4" />
                                Enough time
                              </motion.button>
                            </div>
                          </div>

                          {/* Cuisine */}
                          <div>
                            <label className="block text-sm font-semibold text-foreground mb-3">
                              Cuisine <span className="text-primary">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {cuisineOptions.map((option) => (
                                <motion.button
                                  key={option.id}
                                  type="button"
                                  onClick={() => setMealPlanFormData((prev) => ({ ...prev, cuisine: option.id }))}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className={`pill-button ${
                                    mealPlanFormData.cuisine === option.id
                                      ? "pill-button-active"
                                      : "pill-button-inactive"
                                  }`}
                                >
                                  {option.label}
                                </motion.button>
                              ))}
                            </div>
                          </div>

                          {/* Difficulty */}
                          <div>
                            <label className="block text-sm font-semibold text-foreground mb-3">
                              Difficulty <span className="text-primary">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {difficultyOptions.map((option) => (
                                <motion.button
                                  key={option.id}
                                  type="button"
                                  onClick={() => setMealPlanFormData((prev) => ({ ...prev, difficulty: option.id }))}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className={`pill-button ${
                                    mealPlanFormData.difficulty === option.id
                                      ? "pill-button-active"
                                      : "pill-button-inactive"
                                  }`}
                                >
                                  {option.label}
                                </motion.button>
                              ))}
                            </div>
                          </div>

                          {/* Servings */}
                          <div>
                            <label className="block text-sm font-semibold text-foreground mb-3">
                              Servings <span className="text-primary">*</span>
                            </label>
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={mealPlanFormData.servings}
                                onChange={(e) =>
                                  setMealPlanFormData((prev) => ({ ...prev, servings: parseInt(e.target.value) || 2 }))
                                }
                                className="w-24 px-4 py-3 rounded-xl border-2 text-center font-medium transition-all duration-200 bg-card border-border focus:border-primary focus:outline-none"
                              />
                              <span className="text-muted-foreground">people</span>
                            </div>
                          </div>

                          {/* Budget */}
                          <div>
                            <label className="block text-sm font-semibold text-foreground mb-3">
                              Budget <span className="text-primary">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {budgetOptions.map((option) => (
                                <motion.button
                                  key={option.id}
                                  type="button"
                                  onClick={() => setMealPlanFormData((prev) => ({ ...prev, budget_level: option.id }))}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className={`pill-button ${
                                    mealPlanFormData.budget_level === option.id
                                      ? "pill-button-active"
                                      : "pill-button-inactive"
                                  }`}
                                >
                                  {option.label}
                                </motion.button>
                              ))}
                            </div>
                          </div>

                          {/* Kids Friendly */}
                          <div>
                            <label className="block text-sm font-semibold text-foreground mb-3">
                              Kids Friendly <span className="text-primary">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {kidsFriendlyOptions.map((option) => (
                                <motion.button
                                  key={option.id}
                                  type="button"
                                  onClick={() =>
                                    setMealPlanFormData((prev) => ({ ...prev, kids_friendly: option.value }))
                                  }
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className={`pill-button ${
                                    mealPlanFormData.kids_friendly === option.value
                                      ? "pill-button-active"
                                      : "pill-button-inactive"
                                  }`}
                                >
                                  {option.label}
                                </motion.button>
                              ))}
                            </div>
                          </div>

                          {/* Submit Button */}
                          <div className="pt-4 border-t border-border">
                            <Button
                              className="w-full rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 py-6"
                              disabled={!isMealPlanFormValid || isGeneratingMealPlan}
                              onClick={async () => {
                                if (!selectedDay || !user) return;

                                setIsGeneratingMealPlan(true);
                                try {
                                  const payload = {
                                    time_available: mealPlanFormData.time_available || null,
                                    difficulty: mealPlanFormData.difficulty || null,
                                    cuisine: mealPlanFormData.cuisine || null,
                                    servings: mealPlanFormData.servings || null,
                                    budget_level: mealPlanFormData.budget_level || null,
                                    kids_friendly: mealPlanFormData.kids_friendly,
                                  };

                                  const { data, error } = await supabase.functions.invoke("generate-meal-planner-day", {
                                    body: payload,
                                  });

                                  if (error) {
                                    console.error("Error generating meal plan:", error);
                                    // Try to parse error context for 402 insufficient credits
                                    // error.context is a Response object, need to call json() on it
                                    try {
                                      if (error.context && typeof error.context.json === "function") {
                                        const errorData = await error.context.json();
                                        if (errorData?.error === "INSUFFICIENT_CREDITS") {
                                          setShowCreditsError(true);
                                          setShowMealPlanForm(false);
                                          return;
                                        }
                                      }
                                    } catch {
                                      // Not a JSON error, continue with generic message
                                    }
                                    toast.error("Failed to generate meal plan. Please try again.");
                                    return;
                                  }

                                  if (data?.error === "INSUFFICIENT_CREDITS") {
                                    setShowCreditsError(true);
                                    setShowMealPlanForm(false);
                                    return;
                                  }

                                  if (data?.error) {
                                    toast.error(data.error);
                                    return;
                                  }

                                  // Success - refresh meal plan data
                                  toast.success(
                                    "Full-day meal plan created! Images are being generated in the background.",
                                  );
                                  setShowMealPlanForm(false);

                                  // Refresh the meal plan data
                                  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
                                  const { data: mealPlanData } = await supabase
                                    .from("meal_plan")
                                    .select("id, plan_date, meal_slot, recipe_id, custom_text")
                                    .eq("user_id", user.id)
                                    .gte("plan_date", format(currentWeekStart, "yyyy-MM-dd"))
                                    .lte("plan_date", format(weekEnd, "yyyy-MM-dd"));

                                  if (mealPlanData) {
                                    // Fetch the new recipes
                                    const recipeIds = mealPlanData
                                      .map((m) => m.recipe_id)
                                      .filter((id): id is string => id !== null);
                                    if (recipeIds.length > 0) {
                                      const { data: recipesData } = await supabase
                                        .from("recipe")
                                        .select("*")
                                        .in("id", recipeIds);

                                      const recipeMap = new Map(
                                        (recipesData || []).map((r) => [
                                          r.id,
                                          {
                                            id: r.id,
                                            title: r.title,
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
                                            nutrition_estimate:
                                              r.nutrition_estimate as unknown as Recipe["nutrition_estimate"],
                                            created_at: r.created_at,
                                          } as RecipeWithMeta,
                                        ]),
                                      );

                                      const formattedMealPlan: MealPlanEntry[] = mealPlanData.map((entry) => ({
                                        ...entry,
                                        recipe: recipeMap.get(entry.recipe_id || "") as RecipeWithMeta | undefined,
                                      }));

                                      setMealPlan(formattedMealPlan);
                                    }
                                  }
                                } catch (err) {
                                  console.error("Error:", err);
                                  toast.error("An error occurred. Please try again.");
                                } finally {
                                  setIsGeneratingMealPlan(false);
                                }
                              }}
                            >
                              {isGeneratingMealPlan ? (
                                <>
                                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-5 h-5 mr-2" />
                                  Create Full-Day Meal Plan
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {MEAL_SLOTS.map((slot) => {
                  const meal = getMealForSlot(selectedDay, slot.id);
                  const recipe = meal?.recipe;

                  return (
                    <div
                      key={slot.id}
                      className="bg-card rounded-xl p-4 shadow-sm border border-border flex flex-col min-h-[160px]"
                    >
                      {/* Header: Icon + Label + Delete */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{slot.icon}</span>
                          <h4 className="font-semibold text-foreground">{slot.label}</h4>
                        </div>
                        {meal && (
                          <button
                            className="p-1.5 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMeal(meal.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Content: Recipe details or empty space */}
                      <div className="flex-1 flex flex-col justify-between">
                        {recipe ? (
                          <>
                            <div className="w-full h-20 rounded-lg overflow-hidden mb-2 relative">
                              {recipeImages[recipe.id] ? (
                                <img
                                  src={recipeImages[recipe.id]}
                                  alt={recipe.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground/50 font-medium">No Image</span>
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <h5 className="font-medium text-foreground text-sm line-clamp-2">{recipe.title}</h5>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {recipe.time_minutes && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {recipe.time_minutes}m
                                  </span>
                                )}
                                {recipe.servings && (
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {recipe.servings}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              className="mt-3 py-2 px-4 rounded-full border border-primary/30 bg-primary/10 text-primary font-medium text-sm hover:bg-primary hover:text-primary-foreground transition-colors flex items-center justify-center gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewRecipeModal({ ...recipe, image_url: recipeImages[recipe.id] });
                              }}
                            >
                              <Eye className="w-4 h-4" />
                              View Recipe
                            </button>
                          </>
                        ) : meal?.custom_text ? (
                          <>
                            <div className="w-full h-20 rounded-lg overflow-hidden mb-2">
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <span className="text-xs text-muted-foreground/50 font-medium">No Image</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <h5 className="font-medium text-foreground text-sm line-clamp-2">{meal.custom_text}</h5>
                              <p className="text-xs text-muted-foreground italic">Custom entry</p>
                            </div>
                            <div className="mt-3" />
                          </>
                        ) : (
                          <>
                            <div className="flex-1" />
                            <button
                              className="mt-3 py-2 px-4 rounded-full bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                              onClick={() => setAddMealModal({ date: selectedDay, slot: slot.id })}
                            >
                              <Plus className="w-4 h-4" />
                              Add Recipe
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Meal Modal */}
      <Dialog open={!!addMealModal} onOpenChange={() => setAddMealModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Add {MEAL_SLOTS.find((s) => s.id === addMealModal?.slot)?.label} for{" "}
              {addMealModal && format(addMealModal.date, "EEEE, MMM d")}
            </DialogTitle>
          </DialogHeader>

          {/* Filter and Search Options */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pb-3 border-b border-border">
            {/* Search Input - takes more space */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or ingredient..."
                value={modalSearchQuery}
                onChange={(e) => setModalSearchQuery(e.target.value)}
                className="pl-10 w-full"
              />
            </div>

            {/* Filter dropdowns - aligned right */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Meal Category Filter */}
              <Select value={modalMealFilter} onValueChange={(value: MealCategoryFilter) => setModalMealFilter(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Meal" />
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
              <Select value={modalCuisineFilter} onValueChange={(value: CuisineFilter) => setModalCuisineFilter(value)}>
                <SelectTrigger className="w-[130px]">
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
            </div>
          </div>

          <ScrollArea className="h-[50vh] pr-4">
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ChefHat className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No favorite recipes yet. Add some recipes to your favorites first!
                </p>
              </div>
            ) : filteredFavorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No recipes match your filters. Try adjusting your search or filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredFavorites.map((recipe) => (
                  <motion.div
                    key={recipe.id}
                    whileHover={{ scale: 1.01 }}
                    className="flex items-center gap-4 p-3 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-colors"
                    onClick={() => handleAddMeal(recipe.id)}
                  >
                    {recipeImages[recipe.id] ? (
                      <img
                        src={recipeImages[recipe.id]}
                        alt={recipe.title}
                        className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-destructive/10 to-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
                        <ChefHat className="w-6 h-6 text-primary/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground line-clamp-1">{recipe.title}</h4>
                      {recipe.description_short && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{recipe.description_short}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {recipe.meal_category && (
                          <span className="text-primary capitalize">{recipe.meal_category}</span>
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
                    </div>
                    <Plus className="w-5 h-5 text-primary flex-shrink-0" />
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Custom Meal Input */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground mb-2">Or add your own choice:</p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Enter your choice."
                value={customMealText}
                onChange={(e) => setCustomMealText(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customMealText.trim()) {
                    handleAddCustomMeal();
                  }
                }}
              />
              <Button onClick={handleAddCustomMeal} disabled={!customMealText.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipe Detail Modal */}
      <RecipeDetailModal recipe={viewRecipeModal} onClose={() => setViewRecipeModal(null)} />
    </div>
  );
}
