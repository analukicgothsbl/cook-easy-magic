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

// Image takes 2/3 of content width, cards take the remaining 1/3
const IMG_COL_W   = Math.round(CONTENT_W * 2 / 3);
const COL_GAP     = 10; // gap between image and cards column
const CARD_COL_W  = CONTENT_W - IMG_COL_W - COL_GAP;
const IMG_ASPECT  = 9 / 14; // height/width ratio for a nice portrait-ish food photo
const IMG_H       = Math.round(IMG_COL_W * IMG_ASPECT);

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

function drawDot(doc: jsPDF, x: number, y: number, r = 0.9, color: readonly [number, number, number] = CORAL) {
  doc.setFillColor(...color);
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

export async function generateRecipePdf(recipe: RecipeWithMeta, imageUrl?: string | null): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const instructions = getInstructions(recipe);

  // ── HEADER ───────────────────────────────────────────────────────────────
  // Compact coral header — just the title
  const HEADER_H = 26;
  doc.setFillColor(...CORAL);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");

  // Brand label — tiny, letter-spaced
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(255, 200, 160);
  doc.setCharSpace(2.5);
  doc.text("COOKMASTER", MARGIN, 7);
  doc.setCharSpace(0);

  // Recipe title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...WHITE);
  const titleLines = splitText(doc, recipe.title, CONTENT_W - 4);
  const titleY = titleLines.length > 1 ? 13 : 18;
  doc.text(titleLines, MARGIN, titleY);

  let y = HEADER_H + 5;

  // ── IMAGE + META CARDS (side by side) ───────────────────────────────────
  const sectionTop = y;
  const imgX = MARGIN;
  const cardsX = MARGIN + IMG_COL_W + COL_GAP;

  // --- LEFT: Recipe image ---
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

      // Soft shadow
      doc.setFillColor(210, 200, 195);
      doc.roundedRect(imgX + 0.8, sectionTop + 0.8, IMG_COL_W, IMG_H, 3, 3, "F");
      doc.addImage(dataUrl, "JPEG", imgX, sectionTop, IMG_COL_W, IMG_H, undefined, "MEDIUM");
    } catch {
      // placeholder rect if image fails
      doc.setFillColor(...CORAL_PALE);
      doc.roundedRect(imgX, sectionTop, IMG_COL_W, IMG_H, 3, 3, "F");
    }
  } else {
    doc.setFillColor(...CORAL_PALE);
    doc.roundedRect(imgX, sectionTop, IMG_COL_W, IMG_H, 3, 3, "F");
  }

  // --- RIGHT: Meta cards stacked vertically ---
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

    // Card background
    doc.setFillColor(...CORAL_PALE);
    doc.setDrawColor(...CORAL_LIGHT);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardsX, cardY, CARD_COL_W, cardH, 2, 2, "FD");

    // Left accent strip
    doc.setFillColor(...CORAL);
    doc.roundedRect(cardsX, cardY, 2.5, cardH, 1.5, 1.5, "F");

    // Center X = card left edge + accent strip width + remaining usable width / 2
    const cardCenterX = cardsX + 2.5 + (CARD_COL_W - 2.5) / 2;

    // Label
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.setCharSpace(0.8);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(chip.label.toUpperCase(), cardCenterX, cardY + cardH * 0.35, { align: "center" });
    doc.setCharSpace(0);

    // Value
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...CORAL);
    doc.text(chip.value, cardCenterX, cardY + cardH * 0.72, { align: "center" });
  });

  y = sectionTop + IMG_H + 6;

  // ── SHORT DESCRIPTION ────────────────────────────────────────────────────
  if (recipe.description_short) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...TEXT_MID);
    const descLines = splitText(doc, recipe.description_short, CONTENT_W);
    doc.text(descLines, MARGIN, y);
    y += descLines.length * 4.5 + 5;
    doc.setFont("helvetica", "normal");
  }

  // ── INGREDIENTS ──────────────────────────────────────────────────────────
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

  // ── INSTRUCTIONS ─────────────────────────────────────────────────────────
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

      // Orange dot bullet (same style as ingredients)
      drawDot(doc, MARGIN + 2, y + lineH * 0.6, 0.85);

      // Step text
      doc.setTextColor(...TEXT_DARK);
      doc.text(lines, MARGIN + 5.5, y + lineH * 0.85);
      y += lines.length * lineH + 2;
    }
    y += 3;
  }

  // ── PRO TIP ──────────────────────────────────────────────────────────────
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
    y += tipBoxH + 4;
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...CORAL);
    doc.rect(0, PAGE_H - 10, PAGE_W, 10, "F");

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.setCharSpace(1.5);
    doc.text("COOKMASTER", MARGIN, PAGE_H - 3.8);
    doc.setCharSpace(0);

    if (totalPages > 1) {
      doc.setFont("helvetica", "normal");
      doc.setCharSpace(0);
      doc.text(`${p} / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 3.8, { align: "right" });
    }
  }

  // ── SAVE ─────────────────────────────────────────────────────────────────
  const filename = `${recipe.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
  doc.save(filename);
}
