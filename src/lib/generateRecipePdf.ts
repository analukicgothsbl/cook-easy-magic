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

// Brand colours — mirrors the app's coral palette
const CORAL       = [234, 88,  12 ] as const;  // primary coral
const CORAL_LIGHT = [254, 215, 170] as const;  // orange-200
const CORAL_PALE  = [255, 247, 237] as const;  // orange-50
const TEXT_DARK   = [28,  25,  23 ] as const;  // stone-900
const TEXT_MID    = [120, 113, 108] as const;  // stone-500
const TEXT_LIGHT  = [168, 162, 158] as const;  // stone-400
const WHITE       = [255, 255, 255] as const;
const DIVIDER     = [231, 229, 228] as const;  // stone-200

const PAGE_W    = 210;
const PAGE_H    = 297;
const MARGIN    = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

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
    healthy_light:          "Healthy Light",
    comfort_food:           "Comfort Food",
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

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN - 14) {
    doc.addPage();
    return MARGIN + 6;
  }
  return y;
}

function drawHRule(doc: jsPDF, yPos: number) {
  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);
}

/** A small filled dot (replaces emoji bullets) */
function drawDot(doc: jsPDF, x: number, y: number, r = 1, color: readonly [number, number, number] = CORAL) {
  doc.setFillColor(...color);
  doc.circle(x, y, r, "F");
}

export async function generateRecipePdf(recipe: RecipeWithMeta, imageUrl?: string | null): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const instructions = getInstructions(recipe);
  let y = 0;

  // ── HEADER BAND ──────────────────────────────────────────────────────────
  // Full-width coral strip
  doc.setFillColor(...CORAL);
  doc.rect(0, 0, PAGE_W, 44, "F");

  // Brand name — top-left, small caps style
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.setCharSpace(2);
  doc.text("COOKMASTER", MARGIN, 12);
  doc.setCharSpace(0);

  // Thin accent rule under brand
  doc.setDrawColor(255, 255, 255, 0.4);
  doc.setLineWidth(0.3);

  // Recipe title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const titleLines = splitText(doc, recipe.title, CONTENT_W - 4);
  // Vertically centre title in the band
  const titleY = titleLines.length > 1 ? 22 : 28;
  doc.text(titleLines, MARGIN, titleY);
  y = 44;

  // ── RECIPE IMAGE ─────────────────────────────────────────────────────────
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

      const imgH = 72;
      // Slight drop-shadow effect via a darker rect behind
      doc.setFillColor(220, 210, 200);
      doc.rect(MARGIN + 0.6, y + 4.6, CONTENT_W, imgH, "F");
      doc.addImage(dataUrl, "JPEG", MARGIN, y + 4, CONTENT_W, imgH, undefined, "MEDIUM");
      y += imgH + 10;
    } catch {
      y += 6;
    }
  } else {
    y += 8;
  }

  // ── META CHIPS ROW ───────────────────────────────────────────────────────
  const chips: Array<{ label: string; value: string }> = [];
  if (recipe.meal_category) chips.push({ label: "Meal",       value: recipe.meal_category });
  if (recipe.time_minutes)  chips.push({ label: "Time",       value: `${recipe.time_minutes} min` });
  if (recipe.servings)      chips.push({ label: "Servings",   value: String(recipe.servings) });
  if (recipe.difficulty)    chips.push({ label: "Difficulty", value: recipe.difficulty });
  if (recipe.cuisine)       chips.push({ label: "Cuisine",    value: formatCuisine(recipe.cuisine) });

  if (chips.length > 0) {
    y = checkPageBreak(doc, y, 14);
    let chipX = MARGIN;

    for (const chip of chips) {
      const labelW  = doc.setFontSize(6.5).getTextWidth(chip.label.toUpperCase());
      const valueW  = doc.setFontSize(8).getTextWidth(chip.value);
      const chipW   = Math.max(labelW, valueW) + 8;

      // Chip background
      doc.setFillColor(...CORAL_PALE);
      doc.roundedRect(chipX, y, chipW, 12, 2, 2, "F");

      // Label (tiny uppercase)
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_LIGHT);
      doc.setCharSpace(0.8);
      doc.text(chip.label.toUpperCase(), chipX + chipW / 2, y + 4.2, { align: "center" });
      doc.setCharSpace(0);

      // Value
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...CORAL);
      doc.text(chip.value, chipX + chipW / 2, y + 9.5, { align: "center" });

      chipX += chipW + 4;
      if (chipX > PAGE_W - MARGIN - 20) break;
    }
    y += 18;
  }

  // ── SHORT DESCRIPTION ────────────────────────────────────────────────────
  if (recipe.description_short) {
    y = checkPageBreak(doc, y, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...TEXT_MID);
    const descLines = splitText(doc, recipe.description_short, CONTENT_W);
    doc.text(descLines, MARGIN, y);
    y += descLines.length * 4.8 + 6;
    doc.setFont("helvetica", "normal");
  }

  // ── NUTRITION BOX ────────────────────────────────────────────────────────
  if (recipe.nutrition_estimate) {
    y = checkPageBreak(doc, y, 26);
    const n   = recipe.nutrition_estimate as unknown as Record<string, string | number>;
    const boxH = 22;

    // Outer border box
    doc.setFillColor(...CORAL_PALE);
    doc.setDrawColor(...CORAL_LIGHT);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 3, 3, "FD");

    // Left coral accent strip
    doc.setFillColor(...CORAL);
    doc.roundedRect(MARGIN, y, 3, boxH, 2, 2, "F");

    // Section label
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setCharSpace(1.2);
    doc.setTextColor(...CORAL);
    doc.text("NUTRITION", MARGIN + 6, y + 6);
    doc.setCharSpace(0);

    const cols  = ["Calories", "Protein", "Carbs", "Fat"];
    const vals  = [
      `${n.calories ?? "-"} kcal`,
      String(n.protein ?? "-"),
      String(n.carbs   ?? "-"),
      String(n.fat     ?? "-"),
    ];
    const colW  = (CONTENT_W - 6) / 4;

    cols.forEach((col, i) => {
      const cx = MARGIN + 6 + colW * i + colW / 2;

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_MID);
      doc.text(col, cx, y + 12, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_DARK);
      doc.text(vals[i], cx, y + 19, { align: "center" });
    });

    y += boxH + 8;
  }

  // ── INGREDIENTS ──────────────────────────────────────────────────────────
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    y = checkPageBreak(doc, y, 20);
    drawHRule(doc, y);
    y += 5;

    // Section heading
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setCharSpace(1.5);
    doc.setTextColor(...CORAL);
    doc.text("INGREDIENTS", MARGIN, y + 4);
    doc.setCharSpace(0);

    // Underline accent
    const headW = doc.getTextWidth("INGREDIENTS") + 6;
    doc.setFillColor(...CORAL);
    doc.rect(MARGIN, y + 6, headW, 0.8, "F");
    y += 12;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(8.5);

    const halfW = (CONTENT_W - 6) / 2;
    const ings  = (recipe.ingredients as Array<string | Ingredient>).map(formatIngredient);
    const half  = Math.ceil(ings.length / 2);
    const left  = ings.slice(0, half);
    const right = ings.slice(half);
    const rowH  = 6;
    const rows  = Math.max(left.length, right.length);

    y = checkPageBreak(doc, y, rows * rowH + 4);

    for (let i = 0; i < rows; i++) {
      // Alternate row tint
      if (i % 2 === 0) {
        doc.setFillColor(250, 247, 245);
        doc.rect(MARGIN, y + i * rowH - 1.5, CONTENT_W, rowH, "F");
      }

      if (left[i]) {
        drawDot(doc, MARGIN + 2, y + i * rowH + 2.2, 0.9);
        doc.setTextColor(...TEXT_DARK);
        doc.text(left[i], MARGIN + 6, y + i * rowH + 3.5);
      }
      if (right[i]) {
        drawDot(doc, MARGIN + halfW + 8, y + i * rowH + 2.2, 0.9);
        doc.setTextColor(...TEXT_DARK);
        doc.text(right[i], MARGIN + halfW + 12, y + i * rowH + 3.5);
      }
    }
    y += rows * rowH + 8;
  }

  // ── INSTRUCTIONS ─────────────────────────────────────────────────────────
  if (instructions.length > 0) {
    y = checkPageBreak(doc, y, 20);
    drawHRule(doc, y);
    y += 5;

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setCharSpace(1.5);
    doc.setTextColor(...CORAL);
    doc.text("INSTRUCTIONS", MARGIN, y + 4);
    doc.setCharSpace(0);

    const headW2 = doc.getTextWidth("INSTRUCTIONS") + 6;
    doc.setFillColor(...CORAL);
    doc.rect(MARGIN, y + 6, headW2, 0.8, "F");
    y += 12;

    doc.setFontSize(8.5);

    for (let i = 0; i < instructions.length; i++) {
      const step   = instructions[i];
      const lines  = splitText(doc, step, CONTENT_W - 16);
      const blockH = lines.length * 5 + 6;

      y = checkPageBreak(doc, y, blockH);

      // Step number badge
      doc.setFillColor(...CORAL);
      doc.circle(MARGIN + 4.5, y + 4, 4.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...WHITE);
      doc.text(String(i + 1), MARGIN + 4.5, y + 5.8, { align: "center" });

      // Step text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXT_DARK);
      doc.text(lines, MARGIN + 12, y + 4);
      y += blockH;
    }
    y += 4;
  }

  // ── PRO TIP ──────────────────────────────────────────────────────────────
  if (recipe.tips) {
    y = checkPageBreak(doc, y, 24);
    const tipLines = splitText(doc, recipe.tips, CONTENT_W - 14);
    const tipBoxH  = tipLines.length * 5 + 14;

    // Tip box with left accent
    doc.setFillColor(...CORAL_PALE);
    doc.setDrawColor(...CORAL_LIGHT);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN, y, CONTENT_W, tipBoxH, 3, 3, "FD");
    doc.setFillColor(...CORAL);
    doc.roundedRect(MARGIN, y, 3, tipBoxH, 2, 2, "F");

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setCharSpace(1);
    doc.setTextColor(...CORAL);
    doc.text("PRO TIP", MARGIN + 7, y + 6.5);
    doc.setCharSpace(0);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(tipLines, MARGIN + 7, y + 12);
    y += tipBoxH + 6;
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Footer band
    doc.setFillColor(...CORAL);
    doc.rect(0, PAGE_H - 12, PAGE_W, 12, "F");

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...WHITE);
    doc.setCharSpace(0.5);
    doc.text("cook-master-recipe.lovable.app", MARGIN, PAGE_H - 5);
    doc.setCharSpace(0);
    doc.text(`${p} / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 5, { align: "right" });
  }

  // ── SAVE ─────────────────────────────────────────────────────────────────
  const filename = `${recipe.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
  doc.save(filename);
}
