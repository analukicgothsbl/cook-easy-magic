import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Lock, Loader2 } from 'lucide-react';

interface RecipeFormProps {
  onSubmit: (data: RecipeFormData) => void;
  isLoading: boolean;
}

export interface RecipeFormData {
  ingredients: string;
  mealType: string;
  timeAvailable: string;
  cuisine: string;
}

const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const cuisineOptions = [
  { id: 'surprise', label: 'Any – Surprise me', locked: false },
  { id: 'homestyle', label: 'Home-style / Traditional', locked: true },
  { id: 'italian', label: 'Italian', locked: true },
  { id: 'mediterranean', label: 'Mediterranean', locked: true },
  { id: 'mexican', label: 'Mexican', locked: true },
  { id: 'asian', label: 'Asian', locked: true },
  { id: 'balkan', label: 'Balkan', locked: true },
  { id: 'healthy', label: 'Healthy – Light', locked: true },
  { id: 'comfort', label: 'Comfort food', locked: true },
];

export const RecipeForm = ({ onSubmit, isLoading }: RecipeFormProps) => {
  const [ingredients, setIngredients] = useState('');
  const [mealType, setMealType] = useState('');
  const [timeAvailable, setTimeAvailable] = useState('');
  const [cuisine, setCuisine] = useState('surprise');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ingredients && mealType && timeAvailable) {
      onSubmit({ ingredients, mealType, timeAvailable, cuisine });
    }
  };

  const isValid = ingredients.trim() && mealType && timeAvailable;

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
                {cuisineOptions.map((option) => (
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
              <p className="text-xs text-muted-foreground mt-2">
                Create a free account to choose cuisine preferences
              </p>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={!isValid || isLoading}
              whileHover={isValid && !isLoading ? { scale: 1.02 } : {}}
              whileTap={isValid && !isLoading ? { scale: 0.98 } : {}}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                isValid && !isLoading
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
          </form>
        </motion.div>
      </div>
    </section>
  );
};
