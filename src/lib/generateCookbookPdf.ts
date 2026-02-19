import { jsPDF } from "jspdf";
import type { Recipe } from "@/components/RecipeCard";

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface RecipeWithMeta extends Recipe {
  id: string;
  created_at: string;
  image_url?: string;
}

// Brand colours
const CORAL       = [234, 88,  12 ] as const;
const CORAL_LIGHT = [254, 215, 170] as const;
const CORAL_PALE  = [255, 247, 237] as const;
const TEXT_DARK   = [28,  25,  23 ] as const;
const TEXT_MID    = [120, 113, 108] as const;
const TEXT_LIGHT  = [168, 162, 158] as const;
const WHITE       = [255, 255, 255] as const;
const DIVIDER     = [231, 229, 228] as const;

const PAGE_W  = 210;
const PAGE_H  = 297;
const MARGIN  = 13;
const CONTENT_W = PAGE_W - MARGIN * 2;

const IMG_COL_W   = Math.round(CONTENT_W * 2 / 3);
const COL_GAP     = 10;
const CARD_COL_W  = CONTENT_W - IMG_COL_W - COL_GAP;
const IMG_ASPECT  = 9 / 14;
const IMG_H       = Math.round(IMG_COL_W * IMG_ASPECT);

const FOOTER_H = 10;
const CONTENT_PAGE_H = PAGE_H - FOOTER_H - MARGIN; // usable bottom boundary

function formatIngredient(ing: string | Ingredient): string {
  if (typeof ing === "string") return ing;
  return `${ing.quantity} ${ing.unit} ${ing.name}`.trim();
}

function formatCuisine(cuisine: string | undefined): string {
  if (!cuisine) return "";
  const map: Record<string, string> = {
    any_surprise_me:        "Any",
    home_style_traditional: "Traditional",
    italian:                "Italian",
    mediterranean:          "Mediterranean",
    mexican:                "Mexican",
    asian:                  "Asian",
    balkan:                 "Balkan",
    healthy_light:          "Healthy",
    comfort_food:           "Comfort",
  };
  return map[cuisine] || cuisine;
}

function getInstructions(recipe: RecipeWithMeta): string[] {
  if (!recipe.instructions) return [];
  if (Array.isArray(recipe.instructions)) {
    if (recipe.instructions.length === 1 && typeof recipe.instructions[0] === "string") {
      const text = recipe.instructions[0];
      const steps = text.split(/(?:\d+\.\s*|\d+\)\s*|\n)+/).filter((s) => s.trim());
      if (steps.length > 1) return steps;
      return text.split(/\.\s+(?=[A-Z])/).filter((s) => s.trim()).map((s) => (s.endsWith(".") ? s : s + "."));
    }
    return recipe.instructions.filter((s) => s && typeof s === "string" && s.trim());
  }
  return [];
}

function splitText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth);
}

function drawDot(doc: jsPDF, x: number, y: number, r = 0.9) {
  doc.setFillColor(...CORAL);
  doc.circle(x, y, r, "F");
}

function drawHRule(doc: jsPDF, yPos: number) {
  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);
}

function drawSectionHeading(doc: jsPDF, label: string, y: number): number {
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setCharSpace(1.5);
  doc.setTextColor(...CORAL);
  doc.text(label, MARGIN, y + 3.5);
  doc.setCharSpace(0);
  const hw = doc.getTextWidth(label) + 4;
  doc.setFillColor(...CORAL);
  doc.rect(MARGIN, y + 5, hw, 0.7, "F");
  return y + 10;
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  doc.setFillColor(...CORAL);
  doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H, "F");

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.setCharSpace(1.5);
  doc.text("COOKMASTER", MARGIN, PAGE_H - 3.8);
  doc.setCharSpace(0);

  doc.setFont("helvetica", "normal");
  doc.setCharSpace(0);
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 3.8, { align: "right" });
}

// ── COVER PAGE ─────────────────────────────────────────────────────────────
function drawCoverPage(doc: jsPDF, userName: string, totalRecipes: number) {
  // Background gradient simulation
  doc.setFillColor(...CORAL);
  doc.rect(0, 0, PAGE_W, PAGE_H * 0.55, "F");

  doc.setFillColor(255, 251, 245);
  doc.rect(0, PAGE_H * 0.55, PAGE_W, PAGE_H * 0.45, "F");

  // Decorative circles
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.08 }));
  doc.circle(PAGE_W - 20, 30, 45, "F");
  doc.circle(20, PAGE_H * 0.5, 30, "F");
  doc.setGState(doc.GState({ opacity: 1 }));

  // Brand label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setCharSpace(3);
  doc.setTextColor(255, 200, 160);
  doc.text("COOKMASTER", PAGE_W / 2, 30, { align: "center" });
  doc.setCharSpace(0);

  // Chef hat icon area (simple circle placeholder)
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.15 }));
  doc.circle(PAGE_W / 2, PAGE_H * 0.3, 28, "F");
  doc.setGState(doc.GState({ opacity: 1 }));

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(...WHITE);
  doc.text(userName + "'s", PAGE_W / 2, PAGE_H * 0.43, { align: "center" });

  doc.setFontSize(44);
  doc.text("Cook Book", PAGE_W / 2, PAGE_H * 0.53, { align: "center" });

  // Divider line
  doc.setDrawColor(255, 200, 160);
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 30, PAGE_H * 0.58, PAGE_W - MARGIN - 30, PAGE_H * 0.58);

  // Subtitle
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MID);
  doc.text("Favorite Recipes Collection", PAGE_W / 2, PAGE_H * 0.64, { align: "center" });

  // Recipe count badge
  doc.setFillColor(...CORAL_PALE);
  doc.setDrawColor(...CORAL_LIGHT);
  doc.setLineWidth(0.4);
  doc.roundedRect(PAGE_W / 2 - 28, PAGE_H * 0.70, 56, 16, 8, 8, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...CORAL);
  doc.text(`${totalRecipes} recipes`, PAGE_W / 2, PAGE_H * 0.70 + 10, { align: "center" });

  // Footer
  doc.setFillColor(...CORAL);
  doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setCharSpace(1.5);
  doc.setTextColor(...WHITE);
  doc.text("COOKMASTER", MARGIN, PAGE_H - 3.8);
  doc.setCharSpace(0);
}

// ── CATEGORY DIVIDER PAGE ──────────────────────────────────────────────────
function drawCategoryPage(doc: jsPDF, category: string, count: number) {
  doc.setFillColor(255, 251, 245);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Left coral accent bar
  doc.setFillColor(...CORAL);
  doc.rect(0, 0, 8, PAGE_H, "F");

  // Category name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.setTextColor(...CORAL);
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  doc.text(label, PAGE_W / 2, PAGE_H / 2 - 8, { align: "center" });

  // Count
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_MID);
  doc.text(`${count} recipe${count !== 1 ? "s" : ""}`, PAGE_W / 2, PAGE_H / 2 + 8, { align: "center" });

  // Decorative line (bottom only)
  doc.setDrawColor(...CORAL_LIGHT);
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 20, PAGE_H / 2 + 18, PAGE_W - MARGIN - 20, PAGE_H / 2 + 18);

  // Footer
  doc.setFillColor(...CORAL);
  doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setCharSpace(1.5);
  doc.setTextColor(...WHITE);
  doc.text("COOKMASTER", MARGIN, PAGE_H - 3.8);
  doc.setCharSpace(0);
}

// ── SINGLE RECIPE PAGE ─────────────────────────────────────────────────────
async function drawRecipePage(
  doc: jsPDF,
  recipe: RecipeWithMeta,
  imageUrl: string | null | undefined
) {
  const instructions = getInstructions(recipe);

  // ── HEADER
  const HEADER_H = 26;
  doc.setFillColor(...CORAL);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(255, 200, 160);
  doc.setCharSpace(2.5);
  doc.text("COOKMASTER", MARGIN, 7);
  doc.setCharSpace(0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...WHITE);
  const titleLines = splitText(doc, recipe.title, CONTENT_W - 4);
  const titleY = titleLines.length > 1 ? 13 : 18;
  doc.text(titleLines, MARGIN, titleY);

  let y = HEADER_H + 5;

  // ── IMAGE + META CARDS
  const sectionTop = y;
  const imgX = MARGIN;
  const cardsX = MARGIN + IMG_COL_W + COL_GAP;

  if (imageUrl) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      doc.setFillColor(210, 200, 195);
      doc.roundedRect(imgX + 0.8, sectionTop + 0.8, IMG_COL_W, IMG_H, 3, 3, "F");
      doc.addImage(dataUrl, "JPEG", imgX, sectionTop, IMG_COL_W, IMG_H, undefined, "MEDIUM");
    } catch {
      doc.setFillColor(...CORAL_PALE);
      doc.roundedRect(imgX, sectionTop, IMG_COL_W, IMG_H, 3, 3, "F");
    }
  } else {
    doc.setFillColor(...CORAL_PALE);
    doc.roundedRect(imgX, sectionTop, IMG_COL_W, IMG_H, 3, 3, "F");
  }

  const chips: Array<{ label: string; value: string }> = [];
  if (recipe.meal_category) chips.push({ label: "Meal",       value: recipe.meal_category.charAt(0).toUpperCase() + recipe.meal_category.slice(1) });
  if (recipe.time_minutes)  chips.push({ label: "Time",       value: `${recipe.time_minutes} min` });
  if (recipe.servings)      chips.push({ label: "Servings",   value: String(recipe.servings) });
  if (recipe.difficulty)    chips.push({ label: "Difficulty", value: recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1) });
  if (recipe.cuisine)       chips.push({ label: "Cuisine",    value: formatCuisine(recipe.cuisine) });

  const cardGap = 2.5;
  const totalCards = chips.length || 1;
  const cardH = (IMG_H - cardGap * (totalCards - 1)) / totalCards;

  chips.forEach((chip, i) => {
    const cardY = sectionTop + i * (cardH + cardGap);
    doc.setFillColor(...CORAL_PALE);
    doc.setDrawColor(...CORAL_LIGHT);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardsX, cardY, CARD_COL_W, cardH, 2, 2, "FD");
    doc.setFillColor(...CORAL);
    doc.roundedRect(cardsX, cardY, 2.5, cardH, 1.5, 1.5, "F");

    const cardCenterX = cardsX + 2.5 + (CARD_COL_W - 2.5) / 2;
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.setCharSpace(0.8);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(chip.label.toUpperCase(), cardCenterX, cardY + cardH * 0.35, { align: "center" });
    doc.setCharSpace(0);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...CORAL);
    doc.text(chip.value, cardCenterX, cardY + cardH * 0.72, { align: "center" });
  });

  y = sectionTop + IMG_H + 6;

  // ── SHORT DESCRIPTION
  if (recipe.description_short) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...TEXT_MID);
    const descLines = splitText(doc, recipe.description_short, CONTENT_W);
    doc.text(descLines, MARGIN, y);
    y += descLines.length * 4.5 + 5;
    doc.setFont("helvetica", "normal");
  }

  // ── INGREDIENTS
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    drawHRule(doc, y);
    y += 4;
    y = drawSectionHeading(doc, "INGREDIENTS", y);

    const ings  = (recipe.ingredients as Array<string | Ingredient>).map(formatIngredient);
    const half  = Math.ceil(ings.length / 2);
    const left  = ings.slice(0, half);
    const right = ings.slice(half);
    const halfW = (CONTENT_W - 6) / 2;
    const rowH  = 5.5;
    const rows  = Math.max(left.length, right.length);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    for (let i = 0; i < rows; i++) {
      if (i % 2 === 0) {
        doc.setFillColor(250, 247, 245);
        doc.rect(MARGIN, y + i * rowH - 1.2, CONTENT_W, rowH, "F");
      }
      if (left[i]) {
        drawDot(doc, MARGIN + 2, y + i * rowH + 2, 0.85);
        doc.setTextColor(...TEXT_DARK);
        doc.text(left[i], MARGIN + 5.5, y + i * rowH + 3.2);
      }
      if (right[i]) {
        drawDot(doc, MARGIN + halfW + 8, y + i * rowH + 2, 0.85);
        doc.setTextColor(...TEXT_DARK);
        doc.text(right[i], MARGIN + halfW + 11.5, y + i * rowH + 3.2);
      }
    }
    y += rows * rowH + 6;
  }

  // ── INSTRUCTIONS
  if (instructions.length > 0) {
    drawHRule(doc, y);
    y += 4;
    y = drawSectionHeading(doc, "INSTRUCTIONS", y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    for (let i = 0; i < instructions.length; i++) {
      const step  = instructions[i];
      const lines = splitText(doc, step, CONTENT_W - 10);
      const lineH = 4.2;

      drawDot(doc, MARGIN + 2, y + lineH * 0.6, 0.85);
      doc.setTextColor(...TEXT_DARK);
      doc.text(lines, MARGIN + 5.5, y + lineH * 0.85);
      y += lines.length * lineH + 2;
    }
    y += 3;
  }

  // ── PRO TIP
  if (recipe.tips) {
    const tipLines = splitText(doc, recipe.tips, CONTENT_W - 12);
    const tipBoxH  = tipLines.length * 4.5 + 12;

    doc.setFillColor(...CORAL_PALE);
    doc.setDrawColor(...CORAL_LIGHT);
    doc.setLineWidth(0.35);
    doc.roundedRect(MARGIN, y, CONTENT_W, tipBoxH, 2.5, 2.5, "FD");
    doc.setFillColor(...CORAL);
    doc.roundedRect(MARGIN, y, 2.5, tipBoxH, 1.5, 1.5, "F");

    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.setCharSpace(1);
    doc.setTextColor(...CORAL);
    doc.text("PRO TIP", MARGIN + 6, y + 5.5);
    doc.setCharSpace(0);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(tipLines, MARGIN + 6, y + 10);
  }
}

// ── TABLE OF CONTENTS PAGE ─────────────────────────────────────────────────
function drawTocPage(
  doc: jsPDF,
  recipesByCategory: Record<string, RecipeWithMeta[]>
) {
  doc.setFillColor(255, 251, 245);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Header bar
  doc.setFillColor(...CORAL);
  doc.rect(0, 0, PAGE_W, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.setCharSpace(1);
  doc.text("TABLE OF CONTENTS", MARGIN, 14);
  doc.setCharSpace(0);

  let y = 36;

  Object.entries(recipesByCategory).forEach(([category, recipes]) => {
    const label = category.charAt(0).toUpperCase() + category.slice(1);

    // Category heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...CORAL);
    doc.text(label, MARGIN, y);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MID);
    doc.text(`${recipes.length} recipe${recipes.length !== 1 ? "s" : ""}`, PAGE_W - MARGIN, y, { align: "right" });

    y += 5;
    drawHRule(doc, y);
    y += 4;

    // Recipe list
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_DARK);
    recipes.forEach((recipe) => {
      drawDot(doc, MARGIN + 2, y - 0.5, 0.7);
      doc.text(recipe.title, MARGIN + 6, y);
      y += 5.5;
    });

    y += 5;
  });

  // Footer
  doc.setFillColor(...CORAL);
  doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setCharSpace(1.5);
  doc.setTextColor(...WHITE);
  doc.text("COOKMASTER", MARGIN, PAGE_H - 3.8);
  doc.setCharSpace(0);
}

// ── MAIN EXPORT ────────────────────────────────────────────────────────────
export async function generateCookbookPdf(
  recipesByCategory: Record<string, RecipeWithMeta[]>,
  recipeImages: Record<string, string>,
  userName: string
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const totalRecipes = Object.values(recipesByCategory).reduce((sum, r) => sum + r.length, 0);
  const categories = Object.keys(recipesByCategory);

  // We'll do a two-pass approach:
  // Pass 1: draw all pages, then go back and stamp footers with correct page numbers
  // jsPDF doesn't support deferred rendering easily, so we count pages first.

  // Count total pages: 1 cover + 1 TOC + per category: 1 divider + N recipe pages
  const totalPages = 1 + 1 + categories.reduce((sum, cat) => sum + 1 + recipesByCategory[cat].length, 0);

  // ── PAGE 1: COVER
  drawCoverPage(doc, userName, totalRecipes);
  // Re-draw footer with page info
  doc.setFillColor(...CORAL);
  doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setCharSpace(1.5);
  doc.setTextColor(255, 255, 255);
  doc.text("COOKMASTER", MARGIN, PAGE_H - 3.8);
  doc.setCharSpace(0);
  doc.setFont("helvetica", "normal");
  doc.text(`1 / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 3.8, { align: "right" });

  // ── PAGE 2: TABLE OF CONTENTS
  doc.addPage();
  drawTocPage(doc, recipesByCategory);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`2 / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 3.8, { align: "right" });

  let pageNum = 3;

  // ── CATEGORY SECTIONS
  for (const category of categories) {
    const categoryRecipes = recipesByCategory[category];

    // Category divider page
    doc.addPage();
    drawCategoryPage(doc, category, categoryRecipes.length);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 3.8, { align: "right" });
    pageNum++;

    // Recipe pages
    for (const recipe of categoryRecipes) {
      doc.addPage();
      await drawRecipePage(doc, recipe, recipeImages[recipe.id] || null);
      drawFooter(doc, pageNum, totalPages);
      pageNum++;
    }
  }

  const filename = `${userName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_cookbook.pdf`;
  doc.save(filename);
}
