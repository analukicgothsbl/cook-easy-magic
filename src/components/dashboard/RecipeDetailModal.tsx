import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, ChefHat, X, Flame, Download, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { Recipe } from '@/components/RecipeCard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const formatIngredient = (ing: string | Ingredient): string => {
    if (typeof ing === 'string') return ing;
    return `${ing.quantity} ${ing.unit} ${ing.name}`.trim();
  };

  const formatCuisine = (cuisine: string | undefined): string => {
    if (!cuisine) return '';
    const cuisineMap: Record<string, string> = {
      any_surprise_me: 'Any',
      home_style_traditional: 'Traditional',
      italian: 'Italian',
      mediterranean: 'Mediterranean',
      mexican: 'Mexican',
      asian: 'Asian',
      balkan: 'Balkan',
      healthy_light: 'Healthy Light',
      comfort_food: 'Comfort Food',
    };
    return cuisineMap[cuisine] || cuisine;
  };

  // Parse instructions - handle both string and array formats
  const getInstructions = (): string[] => {
    if (!recipe?.instructions) return [];
    
    // If it's already an array with proper steps
    if (Array.isArray(recipe.instructions)) {
      // Check if it's a single string that needs splitting
      if (recipe.instructions.length === 1 && typeof recipe.instructions[0] === 'string') {
        const text = recipe.instructions[0];
        // Try to split by numbered pattern (1. or 1) or newlines)
        const steps = text.split(/(?:\d+\.\s*|\d+\)\s*|\n)+/).filter(s => s.trim());
        if (steps.length > 1) return steps;
        // Split by periods followed by capital letter
        return text.split(/\.\s+(?=[A-Z])/).filter(s => s.trim()).map(s => s.endsWith('.') ? s : s + '.');
      }
      return recipe.instructions.filter(s => s && typeof s === 'string' && s.trim());
    }
    
    return [];
  };

  const instructions = getInstructions();

  const handleDownloadTxt = () => {
    if (!recipe) return;
    
    const cuisineDisplay = formatCuisine(recipe.cuisine);
    
    let content = `${recipe.title}\n`;
    content += `${'='.repeat(recipe.title.length)}\n\n`;
    
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
      content += metaParts.join(' | ') + '\n\n';
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
    
    // Create and download file
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${recipe.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!recipe) return;
    
    setIsGeneratingPdf(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let yPos = margin;
      
      // Helper function to add text with word wrap and page break
      const addText = (text: string, fontSize: number, isBold = false, color: [number, number, number] = [0, 0, 0]) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(text, contentWidth);
        const lineHeight = fontSize * 0.4;
        
        lines.forEach((line: string) => {
          if (yPos + lineHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(line, margin, yPos);
          yPos += lineHeight;
        });
        return lines.length * lineHeight;
      };
      
      // Try to add image if available
      if (recipe.image_url) {
        try {
          const response = await fetch(recipe.image_url);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          
          // Add image at top (centered, max 180x100)
          const imgWidth = 180;
          const imgHeight = 100;
          const xPos = (pageWidth - imgWidth) / 2;
          doc.addImage(base64, 'JPEG', xPos, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 10;
        } catch (imgError) {
          console.log('Could not load image for PDF:', imgError);
        }
      }
      
      // Title
      addText(recipe.title, 20, true);
      yPos += 3;
      
      // Short description
      if (recipe.description_short) {
        addText(recipe.description_short, 11, false, [100, 100, 100]);
        yPos += 5;
      }
      
      // Meta info line
      const cuisineDisplay = formatCuisine(recipe.cuisine);
      const metaParts: string[] = [];
      if (recipe.meal_category) metaParts.push(recipe.meal_category.charAt(0).toUpperCase() + recipe.meal_category.slice(1));
      if (recipe.time_minutes) metaParts.push(`${recipe.time_minutes} min`);
      if (recipe.servings) metaParts.push(`${recipe.servings} servings`);
      if (recipe.difficulty) metaParts.push(recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1));
      if (cuisineDisplay) metaParts.push(cuisineDisplay);
      if (metaParts.length > 0) {
        addText(metaParts.join('  •  '), 10, false, [80, 80, 80]);
        yPos += 5;
      }
      
      // Nutrition
      if (recipe.nutrition_estimate) {
        const nutritionText = `${recipe.nutrition_estimate.calories} kcal  |  Protein: ${recipe.nutrition_estimate.protein}  |  Carbs: ${recipe.nutrition_estimate.carbs}  |  Fat: ${recipe.nutrition_estimate.fat}`;
        addText(nutritionText, 9, false, [100, 100, 100]);
        yPos += 8;
      }
      
      // Ingredients
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        addText('Ingredients', 14, true);
        yPos += 2;
        recipe.ingredients.forEach((ing) => {
          addText(`• ${formatIngredient(ing)}`, 10);
        });
        yPos += 6;
      }
      
      // Instructions
      if (instructions.length > 0) {
        addText('Instructions', 14, true);
        yPos += 2;
        instructions.forEach((step, i) => {
          addText(`${i + 1}. ${step}`, 10);
          yPos += 2;
        });
        yPos += 4;
      }
      
      // Tips
      if (recipe.tips) {
        addText('💡 Pro Tip', 12, true);
        yPos += 1;
        addText(recipe.tips, 10, false, [80, 80, 80]);
      }
      
      // Save PDF
      doc.save(`${recipe.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPdf(false);
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
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
                {headerIcon}
                {recipe.title}
              </h2>
              
              {/* Short Description */}
              {recipe.description_short && (
                <p className="text-muted-foreground">{recipe.description_short}</p>
              )}
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
                <span className="text-muted-foreground capitalize">
                  {formatCuisine(recipe.cuisine)}
                </span>
              )}
            </div>

            {/* Nutrition Estimate - inline style like screenshot */}
            {recipe.nutrition_estimate && (
              <div className="flex flex-wrap gap-3 p-3 bg-secondary/50 rounded-xl">
                <span className="inline-flex items-center gap-1 text-sm">
                  <Flame className="w-4 h-4 text-primary" />
                  <strong>{recipe.nutrition_estimate.calories}</strong> kcal
                </span>
                <span className="text-sm text-muted-foreground">
                  Protein: {recipe.nutrition_estimate.protein}
                </span>
                <span className="text-sm text-muted-foreground">
                  Carbs: {recipe.nutrition_estimate.carbs}
                </span>
                <span className="text-sm text-muted-foreground">
                  Fat: {recipe.nutrition_estimate.fat}
                </span>
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
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleDownloadPdf}
                        disabled={isGeneratingPdf}
                        className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isGeneratingPdf ? 'Generating PDF...' : 'Download as .pdf'}</p>
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
