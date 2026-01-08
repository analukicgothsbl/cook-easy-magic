import { motion } from 'framer-motion';
import { Clock, Users, RefreshCw, Heart, Lock, Lightbulb } from 'lucide-react';
import foodPasta from '@/assets/food-pasta.jpg';

export interface Recipe {
  title: string;
  mealType: string;
  time: string;
  cuisine: string;
  servings: number;
  ingredients: string[];
  steps: string[];
  tip?: string;
}

interface RecipeCardProps {
  recipe: Recipe;
  onGenerateAnother: () => void;
}

export const RecipeCard = ({ recipe, onGenerateAnother }: RecipeCardProps) => {
  return (
    <section className="section-padding bg-background">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="card-warm overflow-hidden"
        >
          {/* Recipe Image (locked for guests) */}
          <div className="relative h-48 sm:h-64 overflow-hidden">
            <img
              src={foodPasta}
              alt={recipe.title}
              className="w-full h-full object-cover blur-sm scale-105"
            />
            <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
              <div className="text-center text-primary-foreground">
                <Lock className="w-8 h-8 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-medium opacity-90">
                  Sign up to see recipe images
                </p>
              </div>
            </div>
          </div>

          {/* Recipe Content */}
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="mb-6">
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground font-serif mb-3">
                {recipe.title}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">
                  {recipe.mealType}
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {recipe.time}
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {recipe.servings} servings
                </span>
                <span className="text-muted-foreground">
                  Cuisine: {recipe.cuisine}
                </span>
              </div>
            </div>

            {/* Ingredients */}
            <div className="mb-6">
              <h4 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm">
                  🥘
                </span>
                Ingredients
              </h4>
              <ul className="grid gap-2 sm:grid-cols-2">
                {recipe.ingredients.map((ingredient, index) => (
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
                {recipe.steps.map((step, index) => (
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
            {recipe.tip && (
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
                    <p className="text-muted-foreground text-sm">{recipe.tip}</p>
                  </div>
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
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-outline flex-1 flex items-center justify-center gap-2"
              >
                <Heart className="w-4 h-4" />
                Save recipe
                <Lock className="w-3 h-3 opacity-60" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
