import jsPDF from 'jspdf';

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface RecipeForPDF {
  id: string;
  title: string;
  meal_category?: string;
  time_minutes?: number;
  servings?: number;
  difficulty?: string;
  ingredients?: (string | Ingredient)[];
  instructions?: string | string[];
  tips?: string;
  imageUrl?: string;
}

const categoryLabels: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
  snack: 'Snack',
  other: 'Other',
};

const formatIngredient = (ing: string | Ingredient): string => {
  if (typeof ing === 'string') return ing;
  const parts = [];
  if (ing.quantity) parts.push(ing.quantity);
  if (ing.unit) parts.push(ing.unit);
  if (ing.name) parts.push(ing.name);
  return parts.join(' ');
};

const getInstructions = (instructions: string | string[] | undefined): string[] => {
  if (!instructions) return [];
  if (Array.isArray(instructions)) {
    return instructions.map(i => String(i));
  }
  if (typeof instructions === 'string') {
    return instructions.split('\n').filter(Boolean);
  }
  return [];
};

// Colors
const PRIMARY_COLOR: [number, number, number] = [234, 88, 12]; // Orange-600
const TEXT_COLOR: [number, number, number] = [31, 41, 55]; // Gray-800
const MUTED_COLOR: [number, number, number] = [107, 114, 128]; // Gray-500
const LIGHT_BG: [number, number, number] = [255, 251, 235]; // Amber-50

export async function generateCookbookPDF(
  userName: string,
  recipesByCategory: Record<string, RecipeForPDF[]>,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  let totalSteps = 2; // cover + back cover
  Object.values(recipesByCategory).forEach(recipes => {
    totalSteps += 1 + recipes.length; // category page + recipes
  });
  let currentStep = 0;

  const updateProgress = (message: string) => {
    currentStep++;
    onProgress?.(Math.round((currentStep / totalSteps) * 100), message);
  };

  // Helper to add page number
  const addPageNumber = (pageNum: number) => {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(`${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  };

  // ===== COVER PAGE =====
  updateProgress('Creating cover page...');
  
  // Background gradient effect (light amber)
  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Chef hat icon placeholder (circle)
  doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2], 0.2);
  doc.circle(pageWidth / 2, 70, 20, 'F');
  
  // Title
  doc.setFontSize(32);
  doc.setTextColor(...TEXT_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.text(`${userName}'s`, pageWidth / 2, 120, { align: 'center' });
  
  doc.setFontSize(42);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text('Cook Book', pageWidth / 2, 140, { align: 'center' });
  
  // Subtitle
  doc.setFontSize(12);
  doc.setTextColor(...MUTED_COLOR);
  doc.setFont('helvetica', 'normal');
  doc.text('❤ Favorite Recipes Collection ❤', pageWidth / 2, 160, { align: 'center' });
  
  // Decorative line
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 30, 170, pageWidth / 2 + 30, 170);

  let pageNum = 1;

  // ===== CATEGORY PAGES & RECIPES =====
  const categories = Object.keys(recipesByCategory);
  
  for (const category of categories) {
    const categoryRecipes = recipesByCategory[category];
    
    // Category divider page
    doc.addPage();
    pageNum++;
    updateProgress(`Creating ${categoryLabels[category] || category} section...`);
    
    doc.setFillColor(...LIGHT_BG);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Category icon placeholder
    doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2], 0.15);
    doc.circle(pageWidth / 2, pageHeight / 2 - 30, 25, 'F');
    
    // Category title
    doc.setFontSize(36);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.setFont('helvetica', 'bold');
    doc.text(categoryLabels[category] || category, pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });
    
    // Decorative lines
    doc.setDrawColor(...PRIMARY_COLOR);
    doc.setLineWidth(0.3);
    doc.line(pageWidth / 2 - 40, pageHeight / 2 + 30, pageWidth / 2 + 40, pageHeight / 2 + 30);
    
    addPageNumber(pageNum);
    
    // Recipe pages
    for (const recipe of categoryRecipes) {
      doc.addPage();
      pageNum++;
      updateProgress(`Adding recipe: ${recipe.title}...`);
      
      let yPos = margin;
      
      // Recipe title
      doc.setFontSize(20);
      doc.setTextColor(...TEXT_COLOR);
      doc.setFont('helvetica', 'bold');
      
      const titleLines = doc.splitTextToSize(recipe.title, contentWidth);
      doc.text(titleLines, margin, yPos + 7);
      yPos += titleLines.length * 8 + 5;
      
      // Decorative line under title
      doc.setDrawColor(...PRIMARY_COLOR);
      doc.setLineWidth(1);
      doc.line(margin, yPos, margin + 40, yPos);
      yPos += 8;
      
      // Meta info
      doc.setFontSize(10);
      doc.setTextColor(...MUTED_COLOR);
      doc.setFont('helvetica', 'normal');
      
      const metaParts = [];
      if (recipe.time_minutes) metaParts.push(`⏱ ${recipe.time_minutes} min`);
      if (recipe.servings) metaParts.push(`👥 ${recipe.servings} servings`);
      if (recipe.difficulty) metaParts.push(`📊 ${recipe.difficulty}`);
      
      if (metaParts.length > 0) {
        doc.text(metaParts.join('  •  '), margin, yPos);
        yPos += 10;
      }
      
      // Ingredients section
      doc.setFontSize(14);
      doc.setTextColor(...PRIMARY_COLOR);
      doc.setFont('helvetica', 'bold');
      doc.text('Ingredients', margin, yPos);
      yPos += 6;
      
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_COLOR);
      doc.setFont('helvetica', 'normal');
      
      const ingredients = (recipe.ingredients || []) as (string | Ingredient)[];
      for (const ing of ingredients) {
        const ingText = `• ${formatIngredient(ing)}`;
        const ingLines = doc.splitTextToSize(ingText, contentWidth);
        
        if (yPos + ingLines.length * 5 > pageHeight - 30) {
          doc.addPage();
          pageNum++;
          yPos = margin;
        }
        
        doc.text(ingLines, margin, yPos);
        yPos += ingLines.length * 5 + 1;
      }
      
      yPos += 8;
      
      // Instructions section
      doc.setFontSize(14);
      doc.setTextColor(...PRIMARY_COLOR);
      doc.setFont('helvetica', 'bold');
      
      if (yPos + 20 > pageHeight - 30) {
        doc.addPage();
        pageNum++;
        yPos = margin;
      }
      
      doc.text('Instructions', margin, yPos);
      yPos += 6;
      
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_COLOR);
      doc.setFont('helvetica', 'normal');
      
      const instructions = getInstructions(recipe.instructions as string | string[]);
      instructions.forEach((step, idx) => {
        const stepText = `${idx + 1}. ${step.replace(/^\d+\.\s*/, '')}`;
        const stepLines = doc.splitTextToSize(stepText, contentWidth);
        
        if (yPos + stepLines.length * 5 > pageHeight - 30) {
          doc.addPage();
          pageNum++;
          yPos = margin;
        }
        
        doc.text(stepLines, margin, yPos);
        yPos += stepLines.length * 5 + 2;
      });
      
      // Tips section (if available)
      if (recipe.tips) {
        yPos += 5;
        
        if (yPos + 20 > pageHeight - 30) {
          doc.addPage();
          pageNum++;
          yPos = margin;
        }
        
        doc.setFontSize(12);
        doc.setTextColor(...PRIMARY_COLOR);
        doc.setFont('helvetica', 'italic');
        doc.text('💡 Tips', margin, yPos);
        yPos += 5;
        
        doc.setFontSize(9);
        doc.setTextColor(...MUTED_COLOR);
        doc.setFont('helvetica', 'normal');
        const tipLines = doc.splitTextToSize(recipe.tips, contentWidth);
        doc.text(tipLines, margin, yPos);
      }
      
      // Add heart at bottom of recipe page
      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38); // Red
      doc.text('❤', pageWidth - margin, pageHeight - 15, { align: 'right' });
      
      addPageNumber(pageNum);
    }
  }

  // ===== BACK COVER =====
  doc.addPage();
  updateProgress('Finishing cookbook...');
  
  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Chef hat placeholder
  doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2], 0.1);
  doc.circle(pageWidth / 2, pageHeight / 2 - 10, 30, 'F');
  
  // Text
  doc.setFontSize(14);
  doc.setTextColor(...MUTED_COLOR);
  doc.setFont('helvetica', 'normal');
  doc.text('Made with love', pageWidth / 2, pageHeight / 2 + 30, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Cook Master', pageWidth / 2, pageHeight / 2 + 40, { align: 'center' });
  
  // Return as blob
  return doc.output('blob');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
