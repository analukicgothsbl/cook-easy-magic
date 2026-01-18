import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Search
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { Recipe } from '@/components/RecipeCard';
import type { Json } from '@/integrations/supabase/types';

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
  recipe_id: string;
  recipe?: RecipeWithMeta;
}

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { id: 'snack_morning', label: 'Morning Snack', icon: '🍎' },
  { id: 'lunch', label: 'Lunch', icon: '☀️' },
  { id: 'snack_afternoon', label: 'Afternoon Snack', icon: '🍪' },
  { id: 'dinner', label: 'Dinner', icon: '🌙' },
] as const;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MealPlannerView() {
  const { user } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([]);
  const [favorites, setFavorites] = useState<RecipeWithMeta[]>([]);
  const [recipeImages, setRecipeImages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addMealModal, setAddMealModal] = useState<{ date: Date; slot: string } | null>(null);
  
  // Modal filter states
  const [modalMealFilter, setModalMealFilter] = useState<MealCategoryFilter>("all");
  const [modalCuisineFilter, setModalCuisineFilter] = useState<CuisineFilter>("all");
  const [modalSearchQuery, setModalSearchQuery] = useState("");

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
    }
  }, [addMealModal]);

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
            if (typeof ing === 'string') {
              return ing.toLowerCase().includes(query);
            }
            // If ingredient is an object with name property
            if (ing && typeof ing === 'object' && 'name' in ing) {
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
          .from('meal_plan')
          .select('id, plan_date, meal_slot, recipe_id')
          .eq('user_id', user.id)
          .gte('plan_date', format(currentWeekStart, 'yyyy-MM-dd'))
          .lte('plan_date', format(weekEnd, 'yyyy-MM-dd'));

        if (mealPlanError) {
          console.error('Error fetching meal plan:', mealPlanError);
        }

        // Fetch favorites
        const { data: favoritesData, error: favoritesError } = await supabase
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

        if (favoritesError) {
          console.error('Error fetching favorites:', favoritesError);
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
              nutrition_estimate: recipe.nutrition_estimate as unknown as Recipe['nutrition_estimate'],
              created_at: item.created_at,
            };
          });

        setFavorites(formattedFavorites);

        // Create recipe lookup map
        const recipeMap = new Map(formattedFavorites.map(r => [r.id, r]));

        // Format meal plan with recipe details
        const formattedMealPlan: MealPlanEntry[] = (mealPlanData || []).map(entry => ({
          ...entry,
          recipe: recipeMap.get(entry.recipe_id),
        }));

        setMealPlan(formattedMealPlan);

        // Fetch recipe images
        const allRecipeIds = [...new Set([
          ...formattedFavorites.map(r => r.id),
          ...(mealPlanData || []).map(m => m.recipe_id)
        ])];

        if (allRecipeIds.length > 0) {
          const { data: imageData } = await supabase
            .from('recipe_image')
            .select('recipe_id, image_url')
            .in('recipe_id', allRecipeIds);

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

    fetchData();
  }, [user, currentWeekStart]);

  // Get meal for a specific date and slot
  const getMealForSlot = (date: Date, slotId: string): MealPlanEntry | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return mealPlan.find(m => m.plan_date === dateStr && m.meal_slot === slotId);
  };

  // Add meal to plan
  const handleAddMeal = async (recipeId: string) => {
    if (!user || !addMealModal) return;

    const dateStr = format(addMealModal.date, 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase
        .from('meal_plan')
        .insert({
          user_id: user.id,
          plan_date: dateStr,
          meal_slot: addMealModal.slot,
          recipe_id: recipeId,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('A meal is already planned for this slot');
        } else {
          toast.error('Failed to add meal');
          console.error('Error adding meal:', error);
        }
        return;
      }

      const recipe = favorites.find(f => f.id === recipeId);
      setMealPlan(prev => [...prev, { ...data, recipe }]);
      setAddMealModal(null);
      toast.success('Meal added to plan!');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to add meal');
    }
  };

  // Remove meal from plan
  const handleRemoveMeal = async (mealId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('meal_plan')
        .delete()
        .eq('id', mealId)
        .eq('user_id', user.id);

      if (error) {
        toast.error('Failed to remove meal');
        console.error('Error removing meal:', error);
        return;
      }

      setMealPlan(prev => prev.filter(m => m.id !== mealId));
      toast.success('Meal removed');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to remove meal');
    }
  };

  // Navigate weeks
  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
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
          {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
        </h2>
      </div>

      {/* Week Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day, dayIndex) => {
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const dayMeals = mealPlan.filter(m => m.plan_date === format(day, 'yyyy-MM-dd'));

          return (
            <motion.div
              key={day.toISOString()}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: dayIndex * 0.05 }}
              className={`card-warm p-3 cursor-pointer transition-all ${
                isToday ? 'ring-2 ring-primary' : ''
              } ${isSelected ? 'bg-primary/5' : ''}`}
              onClick={() => setSelectedDay(isSelected ? null : day)}
            >
              {/* Day Header */}
              <div className="text-center mb-3">
                <p className="text-xs text-muted-foreground uppercase">{DAY_NAMES[dayIndex]}</p>
                <p className={`text-lg font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {format(day, 'd')}
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
                        meal 
                          ? 'bg-primary/10 text-foreground' 
                          : 'bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span>{slot.icon}</span>
                        <span className="truncate flex-1">
                          {meal?.recipe?.title || slot.label}
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
                    {dayMeals.length} meal{dayMeals.length !== 1 ? 's' : ''} planned
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
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 overflow-hidden"
          >
            <div className="card-warm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-foreground">
                  {format(selectedDay, 'EEEE, MMMM d')}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedDay(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {MEAL_SLOTS.map((slot) => {
                  const meal = getMealForSlot(selectedDay, slot.id);
                  const recipe = meal?.recipe;

                  return (
                    <div
                      key={slot.id}
                      className="bg-muted/30 rounded-lg p-4 border border-border"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{slot.icon}</span>
                          <h4 className="font-medium text-foreground">{slot.label}</h4>
                        </div>
                        {meal && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMeal(meal.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {recipe ? (
                        <div className="space-y-2">
                          {recipeImages[recipe.id] ? (
                            <img
                              src={recipeImages[recipe.id]}
                              alt={recipe.title}
                              className="w-full h-24 object-cover rounded-md"
                            />
                          ) : (
                            <div className="w-full h-24 bg-gradient-to-br from-destructive/10 to-primary/10 rounded-md flex items-center justify-center">
                              <ChefHat className="w-8 h-8 text-primary/40" />
                            </div>
                          )}
                          <h5 className="font-medium text-foreground text-sm line-clamp-2">
                            {recipe.title}
                          </h5>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full h-24 border-dashed"
                          onClick={() => setAddMealModal({ date: selectedDay, slot: slot.id })}
                        >
                          <Plus className="w-5 h-5 mr-2" />
                          Add Recipe
                        </Button>
                      )}
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
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              Add {MEAL_SLOTS.find(s => s.id === addMealModal?.slot)?.label} for{' '}
              {addMealModal && format(addMealModal.date, 'EEEE, MMM d')}
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

          <ScrollArea className="h-[55vh] pr-4">
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
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {recipe.description_short}
                        </p>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
