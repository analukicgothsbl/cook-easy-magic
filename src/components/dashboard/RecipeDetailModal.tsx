import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Users, ChefHat, X, Flame, Download, Copy, Check, FileText } from "lucide-react";
import { generateRecipePdf } from "@/lib/generateRecipePdf";
import type { Recipe } from "@/components/RecipeCard";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
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

interface RecipeDetailModalProps {
  recipe: RecipeWithMeta | null;
  onClose: () => void;
  headerIcon?: React.ReactNode;
}

export function RecipeDetailModal({ recipe, onClose, headerIcon }: RecipeDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Fetch image on mount - no polling, just check once
  useEffect(() => {
    if (!recipe?.id) {
      setImageUrl(null);
      return;
    }

    // If recipe already has image_url, use it
    if (recipe.image_url) {
      setImageUrl(recipe.image_url);
      return;
    }

    // Check database for image (in case it was generated but not passed in props)
    const fetchImage = async () => {
      try {
        const { data, error } = await supabase
          .from("recipe_image")
          .select("image_url")
          .eq("recipe_id", recipe.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching recipe image:", error);
          return;
        }

        if (data?.image_url) {
          setImageUrl(data.image_url);
        }
      } catch (err) {
        console.error("Error fetching recipe image:", err);
      }
    };

    fetchImage();
  }, [recipe?.id, recipe?.image_url]);

  const formatIngredient = (ing: string | Ingredient): string => {
    if (typeof ing === "string") return ing;
    return `${ing.quantity} ${ing.unit} ${ing.name}`.trim();
  };

  const formatCuisine = (cuisine: string | undefined): string => {
    if (!cuisine) return "";
    const cuisineMap: Record<string, string> = {
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
    return cuisineMap[cuisine] || cuisine;
  };

  // Parse instructions - handle both string and array formats
  const getInstructions = (): string[] => {
    if (!recipe?.instructions) return [];

    // If it's already an array with proper steps
    if (Array.isArray(recipe.instructions)) {
      // Check if it's a single string that needs splitting
      if (recipe.instructions.length === 1 && typeof recipe.instructions[0] === "string") {
        const text = recipe.instructions[0];
        // Try to split by numbered pattern (1. or 1) or newlines)
        const steps = text.split(/(?:\d+\.\s*|\d+\)\s*|\n)+/).filter((s) => s.trim());
        if (steps.length > 1) return steps;
        // Split by periods followed by capital letter
        return text
          .split(/\.\s+(?=[A-Z])/)
          .filter((s) => s.trim())
          .map((s) => (s.endsWith(".") ? s : s + "."));
      }
      return recipe.instructions.filter((s) => s && typeof s === "string" && s.trim());
    }

    return [];
  };

  const instructions = getInstructions();

  const getRecipeTextContent = () => {
    if (!recipe) return "";

    const cuisineDisplay = formatCuisine(recipe.cuisine);

    let content = `${recipe.title}\n`;
    content += `${"=".repeat(recipe.title.length)}\n\n`;

    if (recipe.description_short) {
      content += `${recipe.description_short}\n\n`;
    }

    // Meta info
    const metaParts: string[] = [];
    if (recipe.meal_category) metaParts.push(`Meal: ${recipe.meal_category}`);
    if (recipe.time_minutes) metaParts.push(`Time: ${recipe.time_minutes} min`);
    if (recipe.servings) metaParts.push(`Servings: ${recipe.servings}`);
    if (recipe.difficulty) metaParts.push(`Difficulty: ${recipe.difficulty}`);
    if (cuisineDisplay) metaParts.push(`Cuisine: ${cuisineDisplay}`);
    if (metaParts.length > 0) {
      content += metaParts.join(" | ") + "\n\n";
    }

    // Nutrition
    if (recipe.nutrition_estimate) {
      content += `Nutrition (per serving):\n`;
      content += `  Calories: ${recipe.nutrition_estimate.calories} kcal\n`;
      content += `  Protein: ${recipe.nutrition_estimate.protein}\n`;
      content += `  Carbs: ${recipe.nutrition_estimate.carbs}\n`;
      content += `  Fat: ${recipe.nutrition_estimate.fat}\n\n`;
    }

    // Ingredients
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      content += `Ingredients:\n`;
      content += `-----------\n`;
      recipe.ingredients.forEach((ing) => {
        content += `• ${formatIngredient(ing)}\n`;
      });
      content += `\n`;
    }

    // Instructions
    if (instructions.length > 0) {
      content += `Instructions:\n`;
      content += `-------------\n`;
      instructions.forEach((step, i) => {
        content += `${i + 1}. ${step}\n`;
      });
      content += `\n`;
    }

    // Tips
    if (recipe.tips) {
      content += `Pro Tip:\n`;
      content += `--------\n`;
      content += `${recipe.tips}\n`;
    }

    return content;
  };

  const handleDownloadTxt = () => {
    const content = getRecipeTextContent();
    if (!content || !recipe) return;

    // Create and download file
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${recipe.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!recipe) return;
    setPdfLoading(true);
    try {
      await generateRecipePdf(recipe as Parameters<typeof generateRecipePdf>[0], imageUrl);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    const content = getRecipeTextContent();
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy recipe:", err);
    }
  };

  if (!recipe) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with just X button */}
          <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-end z-10">
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Recipe Image - only show if image exists */}
          {imageUrl && (
            <div className="relative h-80 sm:h-96 overflow-hidden">
              <img src={imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
                {headerIcon}
                {recipe.title}
              </h2>

              {/* Short Description */}
              {recipe.description_short && <p className="text-muted-foreground">{recipe.description_short}</p>}
            </div>

            {/* Meta Row - matching screenshot style */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {recipe.meal_category && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full font-medium capitalize">
                  {recipe.meal_category}
                </span>
              )}
              {recipe.time_minutes && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {recipe.time_minutes} min
                </span>
              )}
              {recipe.servings && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {recipe.servings} servings
                </span>
              )}
              {recipe.difficulty && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground capitalize">
                  <ChefHat className="w-4 h-4" />
                  {recipe.difficulty}
                </span>
              )}
              {recipe.cuisine && (
                <span className="text-muted-foreground capitalize">{formatCuisine(recipe.cuisine)}</span>
              )}
            </div>

            {/* Nutrition Estimate - inline style like screenshot */}
            {recipe.nutrition_estimate && (
              <div className="flex flex-wrap gap-3 p-3 bg-secondary/50 rounded-xl">
                <span className="inline-flex items-center gap-1 text-sm">
                  <Flame className="w-4 h-4 text-primary" />
                  <strong>{recipe.nutrition_estimate.calories}</strong> kcal
                </span>
                <span className="text-sm text-muted-foreground">Protein: {recipe.nutrition_estimate.protein}</span>
                <span className="text-sm text-muted-foreground">Carbs: {recipe.nutrition_estimate.carbs}</span>
                <span className="text-sm text-muted-foreground">Fat: {recipe.nutrition_estimate.fat}</span>
              </div>
            )}

            {/* Ingredients - 2 column layout */}
            {recipe.ingredients && recipe.ingredients.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm">
                    🥘
                  </span>
                  Ingredients
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2 text-foreground">
                      <span className="text-primary mt-0.5">•</span>
                      {formatIngredient(ing)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Instructions - numbered steps */}
            {instructions.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm">
                    📝
                  </span>
                  Instructions
                </h3>
                <ol className="space-y-4">
                  {instructions.map((step, i) => (
                    <li key={i} className="flex gap-4">
                      <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                        {i + 1}
                      </span>
                      <p className="text-foreground pt-1">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Tips */}
            {recipe.tips && (
              <div className="p-4 bg-accent rounded-xl border border-primary/20">
                <p className="font-semibold text-foreground text-sm mb-1">💡 Pro tip</p>
                <p className="text-muted-foreground text-sm">{recipe.tips}</p>
              </div>
            )}

            {/* Recipe Actions */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleDownloadTxt}
                        className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download as .txt</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleDownloadPdf}
                        disabled={pdfLoading}
                        className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        {pdfLoading ? (
                          <span className="w-5 h-5 flex items-center justify-center">
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          </span>
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{pdfLoading ? "Generating PDF…" : "Download as PDF"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleCopyToClipboard}
                        className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {copied ? <Check className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{copied ? "Copied!" : "Copy to clipboard"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
