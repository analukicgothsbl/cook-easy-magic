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

// Brand colours (coral palette)
const CORAL = [255, 138, 76] as const;      // hsl(22,100%,65%)  → #FF8A4C
const CORAL_DARK = [210, 90, 40] as const;   // hsl(18,85%,50%)   → #D25A28
const CREAM = [253, 248, 243] as const;      // hsl(35,50%,96%)
const TEXT_DARK = [45, 32, 20] as const;     // hsl(25,30%,15%)
const TEXT_MID = [120, 100, 80] as const;    // muted foreground
const WHITE = [255, 255, 255] as const;

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

function formatIngredient(ing: string | Ingredient): string {
  if (typeof ing === "string") return ing;
  return `${ing.quantity} ${ing.unit} ${ing.name}`.trim();
}

function formatCuisine(cuisine: string | undefined): string {
  if (!cuisine) return "";
  const map: Record<string, string> = {
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

/** Wraps text and returns array of lines that fit within maxWidth */
function splitText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth);
}

/** Draw a filled rounded rectangle */
function roundedRect(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  r: number,
  fill: readonly [number, number, number],
  stroke?: readonly [number, number, number],
) {
  doc.setFillColor(...fill);
  if (stroke) doc.setDrawColor(...stroke);
  doc.roundedRect(x, y, w, h, r, r, stroke ? "FD" : "F");
}

/** Clamp y so it doesn't overflow the page; add new page if needed */
function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN + 8;
  }
  return y;
}

export async function generateRecipePdf(recipe: RecipeWithMeta, imageUrl?: string | null): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const instructions = getInstructions(recipe);
  let y = 0;

  // ── HEADER BAND ──────────────────────────────────────────────────────────
  doc.setFillColor(...CORAL);
  doc.rect(0, 0, PAGE_W, 38, "F");

  // Logo / brand text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text("🍳  CookMaster", MARGIN, 14);

  // Title
  doc.setFontSize(20);
  const titleLines = splitText(doc, recipe.title, CONTENT_W - 4);
  doc.text(titleLines, MARGIN, 26);
  y = 38;

  // ── RECIPE IMAGE ─────────────────────────────────────────────────────────
  if (imageUrl) {
    try {
      // Fetch image as data URL
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const imgH = 70;
      doc.addImage(dataUrl, "JPEG", MARGIN, y + 4, CONTENT_W, imgH, undefined, "MEDIUM");
      y += imgH + 8;
    } catch {
      // Image failed to load - skip silently
      y += 4;
    }
  } else {
    y += 6;
  }

  // ── META CHIPS ROW ───────────────────────────────────────────────────────
  const chips: string[] = [];
  if (recipe.meal_category) chips.push(`🍽 ${recipe.meal_category}`);
  if (recipe.time_minutes) chips.push(`⏱ ${recipe.time_minutes} min`);
  if (recipe.servings) chips.push(`👥 ${recipe.servings} servings`);
  if (recipe.difficulty) chips.push(`👨‍🍳 ${recipe.difficulty}`);
  if (recipe.cuisine) chips.push(formatCuisine(recipe.cuisine));

  y = checkPageBreak(doc, y, 12);
  let chipX = MARGIN;
  doc.setFontSize(8);
  for (const chip of chips) {
    const chipW = doc.getTextWidth(chip) + 6;
    roundedRect(doc, chipX, y, chipW, 7, 2, [255, 230, 210]);
    doc.setTextColor(...CORAL_DARK);
    doc.text(chip, chipX + 3, y + 5);
    chipX += chipW + 3;
    if (chipX > PAGE_W - MARGIN - 20) break; // prevent overflow
  }
  y += 12;

  // ── SHORT DESCRIPTION ────────────────────────────────────────────────────
  if (recipe.description_short) {
    y = checkPageBreak(doc, y, 12);
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MID);
    doc.setFont("helvetica", "italic");
    const descLines = splitText(doc, recipe.description_short, CONTENT_W);
    doc.text(descLines, MARGIN, y);
    y += descLines.length * 4.5 + 4;
    doc.setFont("helvetica", "normal");
  }

  // ── NUTRITION BOX ────────────────────────────────────────────────────────
  if (recipe.nutrition_estimate) {
    y = checkPageBreak(doc, y, 20);
    const n = recipe.nutrition_estimate;
    const boxH = 16;
    roundedRect(doc, MARGIN, y, CONTENT_W, boxH, 3, CREAM);
    doc.setFillColor(...CORAL);
    doc.setDrawColor(...CORAL);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...CORAL_DARK);
    const labels = ["🔥 Calories", "Protein", "Carbs", "Fat"];
    const values = [`${n.calories} kcal`, String(n.protein), String(n.carbs), String(n.fat)];
    const colW = CONTENT_W / 4;
    labels.forEach((label, i) => {
      const cx = MARGIN + colW * i + colW / 2;
      doc.text(label, cx, y + 6, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_DARK);
      doc.text(values[i], cx, y + 12, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...CORAL_DARK);
    });
    y += boxH + 6;
  }

  // ── DIVIDER ──────────────────────────────────────────────────────────────
  const drawDivider = (yPos: number) => {
    doc.setDrawColor(...CORAL);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);
  };

  // ── INGREDIENTS ──────────────────────────────────────────────────────────
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    y = checkPageBreak(doc, y, 16);

    // Section heading
    roundedRect(doc, MARGIN, y, 40, 7, 2, CORAL);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text("🥘  Ingredients", MARGIN + 3, y + 5);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(9);

    // Two-column layout
    const halfW = (CONTENT_W - 4) / 2;
    const ings = recipe.ingredients.map(formatIngredient);
    const half = Math.ceil(ings.length / 2);
    const left = ings.slice(0, half);
    const right = ings.slice(half);
    const rowCount = Math.max(left.length, right.length);
    const rowH = 5.5;

    y = checkPageBreak(doc, y, rowCount * rowH + 4);

    for (let i = 0; i < rowCount; i++) {
      if (i % 2 === 0) {
        doc.setFillColor(250, 245, 240);
        doc.rect(MARGIN, y + i * rowH - 1, CONTENT_W, rowH, "F");
      }
      if (left[i]) {
        doc.setTextColor(...CORAL);
        doc.text("•", MARGIN + 1, y + i * rowH + 3.5);
        doc.setTextColor(...TEXT_DARK);
        doc.text(left[i], MARGIN + 5, y + i * rowH + 3.5);
      }
      if (right[i]) {
        doc.setTextColor(...CORAL);
        doc.text("•", MARGIN + halfW + 5, y + i * rowH + 3.5);
        doc.setTextColor(...TEXT_DARK);
        doc.text(right[i], MARGIN + halfW + 9, y + i * rowH + 3.5);
      }
    }
    y += rowCount * rowH + 6;
    drawDivider(y);
    y += 4;
  }

  // ── INSTRUCTIONS ─────────────────────────────────────────────────────────
  if (instructions.length > 0) {
    y = checkPageBreak(doc, y, 16);

    roundedRect(doc, MARGIN, y, 42, 7, 2, CORAL);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text("📝  Instructions", MARGIN + 3, y + 5);
    y += 10;

    doc.setFontSize(9);
    for (let i = 0; i < instructions.length; i++) {
      const step = instructions[i];
      const lines = splitText(doc, step, CONTENT_W - 14);
      const blockH = lines.length * 4.5 + 4;

      y = checkPageBreak(doc, y, blockH);

      // Step number badge
      doc.setFillColor(...CORAL);
      doc.circle(MARGIN + 4, y + 3, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...WHITE);
      doc.setFontSize(8);
      doc.text(String(i + 1), MARGIN + 4, y + 4.5, { align: "center" });

      // Step text
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(9);
      doc.text(lines, MARGIN + 10, y + 3.5);
      y += blockH;
    }
    y += 4;
  }

  // ── PRO TIP ──────────────────────────────────────────────────────────────
  if (recipe.tips) {
    y = checkPageBreak(doc, y, 20);
    const tipLines = splitText(doc, recipe.tips, CONTENT_W - 10);
    const tipBoxH = tipLines.length * 4.5 + 10;

    roundedRect(doc, MARGIN, y, CONTENT_W, tipBoxH, 3, [255, 240, 225], CORAL);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...CORAL_DARK);
    doc.text("💡  Pro Tip", MARGIN + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_DARK);
    doc.text(tipLines, MARGIN + 4, y + 12);
    y += tipBoxH + 6;
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...CORAL);
    doc.rect(0, PAGE_H - 10, PAGE_W, 10, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...WHITE);
    doc.text("Generated by CookMaster · cook-master-recipe.lovable.app", MARGIN, PAGE_H - 4);
    doc.text(`Page ${p} / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 4, { align: "right" });
  }

  // ── SAVE ─────────────────────────────────────────────────────────────────
  const filename = `${recipe.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
  doc.save(filename);
}
