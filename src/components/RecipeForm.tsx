import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Lock, Loader2, ChevronDown, ChevronUp, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecipeFormProps {
  onSubmit: (data: RecipeFormData) => void;
  isLoading: boolean;
  isRegistered?: boolean;
  isGuestBlocked?: boolean;
}

export interface RecipeFormData {
  ingredients: string[];
  meal_category: string;
  time_available: string;
  cuisine: string;
  difficulty: string | null;
  servings: number;
  budget_level: string | null;
  kids_friendly: boolean | null;
}

const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'];

const cuisineOptions = [
  { id: 'any_surprise_me', label: 'Any – Surprise me', locked: false },
  { id: 'home_style_traditional', label: 'Home-style / Traditional', locked: true },
  { id: 'italian', label: 'Italian', locked: true },
  { id: 'mediterranean', label: 'Mediterranean', locked: true },
  { id: 'mexican', label: 'Mexican', locked: true },
  { id: 'asian', label: 'Asian', locked: true },
  { id: 'balkan', label: 'Balkan', locked: true },
  { id: 'healthy_light', label: 'Healthy – Light', locked: true },
  { id: 'comfort_food', label: 'Comfort food', locked: true },
];

const difficultyOptions = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

const budgetOptions = [
  { id: 'cheap', label: 'Cheap' },
  { id: 'normal', label: 'Normal' },
  { id: 'doesnt_matter', label: "Doesn't matter" },
];

const kidsFriendlyOptions = [
  { id: 'yes', label: 'Yes', value: true },
  { id: 'no', label: 'No', value: false },
];

export const RecipeForm = ({ onSubmit, isLoading, isRegistered = false, isGuestBlocked = false }: RecipeFormProps) => {
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState('');
  const [mealType, setMealType] = useState('');
  const [timeAvailable, setTimeAvailable] = useState('');
  const [cuisine, setCuisine] = useState('any_surprise_me');
  const [moreOptionsExpanded, setMoreOptionsExpanded] = useState(false);
  
  // More options state
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [servings, setServings] = useState(2);
  const [budgetLevel, setBudgetLevel] = useState<string | null>(null);
  const [kidsFriendly, setKidsFriendly] = useState<boolean | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ingredients && mealType && timeAvailable) {
      const ingredientsList = ingredients.split(',').map(i => i.trim()).filter(i => i.length > 0);
      
      onSubmit({
        ingredients: ingredientsList,
        meal_category: mealType.toLowerCase(),
        time_available: timeAvailable,
        cuisine: isRegistered ? cuisine : 'any_surprise_me',
        difficulty: isRegistered ? difficulty : null,
        servings: isRegistered ? servings : 2,
        budget_level: isRegistered ? budgetLevel : null,
        kids_friendly: isRegistered ? kidsFriendly : null,
      });
    }
  };

  const isValid = ingredients.trim() && mealType && timeAvailable;

  // For non-registered users, lock the cuisine options except "Any – Surprise me"
  const getCuisineOptions = () => {
    if (isRegistered) {
      return cuisineOptions.map(opt => ({ ...opt, locked: false }));
    }
    return cuisineOptions;
  };

  return (
    <section id="recipe-form" className="section-padding bg-cream-dark/50">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="card-warm p-6 sm:p-8 lg:p-10"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 font-serif">
              Create Your Recipe
            </h2>
            <p className="text-muted-foreground">
              Tell us what you have, and we'll find you something delicious
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Ingredients */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                What ingredients do you have? <span className="text-primary">*</span>
              </label>
              <textarea
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="Chicken, potatoes, onion, garlic"
                className="textarea-warm"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Separate ingredients with commas
              </p>
            </div>

            {/* Meal Type */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">
                What are you cooking? <span className="text-primary">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {mealTypes.map((type) => (
                  <motion.button
                    key={type}
                    type="button"
                    onClick={() => setMealType(type)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`pill-button ${
                      mealType === type ? 'pill-button-active' : 'pill-button-inactive'
                    }`}
                  >
                    {type}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Time Available */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">
                How much time do you have? <span className="text-primary">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  onClick={() => setTimeAvailable('minimum')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-all duration-200 ${
                    timeAvailable === 'minimum'
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-secondary text-secondary-foreground border-2 border-border hover:border-primary/40'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  Minimum time
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setTimeAvailable('enough')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-all duration-200 ${
                    timeAvailable === 'enough'
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-secondary text-secondary-foreground border-2 border-border hover:border-primary/40'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  Enough time
                </motion.button>
              </div>
            </div>

            {/* Cuisine */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">
                Cuisine
              </label>
              <div className="flex flex-wrap gap-2">
                {getCuisineOptions().map((option) => (
                  <motion.button
                    key={option.id}
                    type="button"
                    onClick={() => !option.locked && setCuisine(option.id)}
                    whileHover={!option.locked ? { scale: 1.02 } : {}}
                    whileTap={!option.locked ? { scale: 0.98 } : {}}
                    className={`pill-button flex items-center gap-1.5 ${
                      option.locked
                        ? 'pill-button-locked'
                        : cuisine === option.id
                        ? 'pill-button-active'
                        : 'pill-button-inactive'
                    }`}
                  >
                    {option.locked && <Lock className="w-3 h-3" />}
                    {option.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* More Options Expandable Section */}
            <div className="border-t border-border pt-4">
              <motion.button
                type="button"
                onClick={() => setMoreOptionsExpanded(!moreOptionsExpanded)}
                className="w-full flex items-center justify-center gap-2 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="font-medium">More options</span>
                {moreOptionsExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </motion.button>

              <AnimatePresence>
                {moreOptionsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-6 pt-4">
                      {/* Difficulty */}
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-3">
                          Difficulty
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {difficultyOptions.map((option) => (
                            <motion.button
                              key={option.id}
                              type="button"
                              onClick={() => isRegistered && setDifficulty(option.id)}
                              whileHover={isRegistered ? { scale: 1.02 } : {}}
                              whileTap={isRegistered ? { scale: 0.98 } : {}}
                              className={`pill-button flex items-center gap-1.5 ${
                                !isRegistered
                                  ? 'pill-button-locked'
                                  : difficulty === option.id
                                  ? 'pill-button-active'
                                  : 'pill-button-inactive'
                              }`}
                            >
                              {!isRegistered && <Lock className="w-3 h-3" />}
                              {option.label}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Servings */}
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-3">
                          Servings
                        </label>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={servings}
                              onChange={(e) => isRegistered && setServings(parseInt(e.target.value) || 2)}
                              disabled={!isRegistered}
                              className={`w-24 px-4 py-3 rounded-xl border-2 text-center font-medium transition-all duration-200 ${
                                isRegistered
                                  ? 'bg-secondary border-border focus:border-primary focus:outline-none'
                                  : 'bg-muted border-border text-muted-foreground cursor-not-allowed'
                              }`}
                            />
                            {!isRegistered && (
                              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <span className="text-muted-foreground">people</span>
                        </div>
                      </div>

                      {/* Budget */}
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-3">
                          Budget
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {budgetOptions.map((option) => (
                            <motion.button
                              key={option.id}
                              type="button"
                              onClick={() => isRegistered && setBudgetLevel(option.id)}
                              whileHover={isRegistered ? { scale: 1.02 } : {}}
                              whileTap={isRegistered ? { scale: 0.98 } : {}}
                              className={`pill-button flex items-center gap-1.5 ${
                                !isRegistered
                                  ? 'pill-button-locked'
                                  : budgetLevel === option.id
                                  ? 'pill-button-active'
                                  : 'pill-button-inactive'
                              }`}
                            >
                              {!isRegistered && <Lock className="w-3 h-3" />}
                              {option.label}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Kids Friendly */}
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-3">
                          Kids Friendly
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {kidsFriendlyOptions.map((option) => (
                            <motion.button
                              key={option.id}
                              type="button"
                              onClick={() => isRegistered && setKidsFriendly(option.value)}
                              whileHover={isRegistered ? { scale: 1.02 } : {}}
                              whileTap={isRegistered ? { scale: 0.98 } : {}}
                              className={`pill-button flex items-center gap-1.5 ${
                                !isRegistered
                                  ? 'pill-button-locked'
                                  : kidsFriendly === option.value
                                  ? 'pill-button-active'
                                  : 'pill-button-inactive'
                              }`}
                            >
                              {!isRegistered && <Lock className="w-3 h-3" />}
                              {option.label}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Guest Mode Banner */}
            {!isRegistered && !isGuestBlocked && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-accent/50 rounded-xl border border-primary/20 text-sm"
              >
                <User className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Guest mode:</strong> 1 free recipe. Sign up for more.
                </span>
              </motion.div>
            )}

            {/* Guest Blocked State */}
            {!isRegistered && isGuestBlocked && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-3 p-4 bg-destructive/10 rounded-xl border border-destructive/20"
              >
                <p className="text-sm text-foreground text-center">
                  You've used your free guest recipe. Create a free account to continue!
                </p>
                <motion.button
                  type="button"
                  onClick={() => navigate('/auth')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary py-2 px-4 text-sm"
                >
                  Create free account
                </motion.button>
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={!isValid || isLoading || isGuestBlocked}
              whileHover={isValid && !isLoading && !isGuestBlocked ? { scale: 1.02 } : {}}
              whileTap={isValid && !isLoading && !isGuestBlocked ? { scale: 0.98 } : {}}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                isValid && !isLoading && !isGuestBlocked
                  ? 'bg-primary text-primary-foreground shadow-lg hover:shadow-xl'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating your recipe...
                  </motion.span>
                ) : (
                  <motion.span
                    key="submit"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    🍳 Create my recipe
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {!isRegistered && !isGuestBlocked && (
              <p className="text-xs text-muted-foreground text-center">
                Create a free account to choose cuisine preferences
              </p>
            )}
          </form>
        </motion.div>
      </div>
    </section>
  );
};
